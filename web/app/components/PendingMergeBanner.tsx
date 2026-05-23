"use client";

/**
 * PendingMergeBanner
 *
 * Shown on /cart when an authenticated user still has a pending guest-cart
 * item in sessionStorage that failed to merge on login. Gives them a visible
 * error and Retry / Discard buttons so they don't lose their selections
 * silently.
 *
 * When the failure was caused by FTP file verification (issue #87) the
 * banner renders a per-file breakdown (filename + reason) instead of the
 * generic top-level message — those generic messages were the original
 * UX gripe in the bug report.
 *
 * When the only failures are transient (network / unreadable, issue #94),
 * the banner switches to a softer "Verifying your files… (retrying)" copy
 * because the cart-page sweep is about to re-verify them and the user
 * shouldn't see a hard error for a transient blip.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import {
    clearPendingPurchaseData,
    getPendingPurchaseData,
    hasPendingPurchaseData,
    isPendingPurchaseStaleUnverified,
} from "@/lib/utils/pending-purchase";
import { processPendingAddToCartIntent } from "@/lib/utils/pending-cart-intent";
import { describeVerifyReason } from "@/lib/utils/cart-file-sweep";
import type { VerifyFileInvalidEntry } from "@/lib/api/cart";
import { toastError, toastSuccess } from "@/lib/utils/toast";

const MERGE_ERROR_KEY = "pendingMergeError";
/** Soft-notice key set by AuthGuard when the merge SUCCEEDED but the
 *  FTP verify came back transient and we fail-opened. The banner
 *  renders an amber "your cart is restored, we'll re-verify on
 *  checkout" notice instead of an error so the user isn't told their
 *  cart is broken when the payment-init guard will catch any real
 *  problem before charging them (issue #94). */
const MERGE_NOTICE_KEY = "pendingMergeNotice";

type MergeNotice =
    | { kind: "verify-fell-open"; at: number }
    | null;

function readMergeNotice(): MergeNotice {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(MERGE_NOTICE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MergeNotice;
        if (parsed && parsed.kind === "verify-fell-open" && typeof parsed.at === "number") {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

interface FileFailure {
    name: string;
    reason: VerifyFileInvalidEntry['reason'];
}

/** A failure is "hard" when the file is deterministically bad (empty /
 *  missing). Transient failures (`unreadable` / unknown) get the softer
 *  banner copy — see file docblock. */
function isHardFailure(reason: VerifyFileInvalidEntry['reason']): boolean {
    return reason === 'empty' || reason === 'missing';
}

interface MergeError {
    error: string;
    at: number;
    /** Optional per-file failure detail (issue #87). When present the
     *  banner renders filename + reason rows instead of just `error`. */
    fileFailures?: FileFailure[];
}

function readMergeError(): MergeError | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(MERGE_ERROR_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as MergeError;
    } catch {
        return null;
    }
}

function writeMergeError(payload: MergeError): void {
    try {
        sessionStorage.setItem(MERGE_ERROR_KEY, JSON.stringify(payload));
    } catch {
        /* ignore */
    }
}

export default function PendingMergeBanner({ onMerged }: { onMerged?: () => void }) {
    const [visible, setVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [fileFailures, setFileFailures] = useState<FileFailure[]>([]);
    const [retrying, setRetrying] = useState(false);
    /** "error" — hard failure, retry/discard banner. "notice" — soft
     *  fail-open notice (issue #94), info copy + single dismiss button. */
    const [mode, setMode] = useState<"error" | "notice">("error");
    /** Issue #94 D — when the pending entry is older than the
     *  unverified-stale window we surface a stronger "this looks dead,
     *  consider discarding" prompt alongside the normal Retry/Discard
     *  buttons. */
    const [staleUnverified, setStaleUnverified] = useState(false);

    useEffect(() => {
        if (hasPendingPurchaseData()) {
            const mergeError = readMergeError();
            setMode("error");
            setErrorMessage(mergeError?.error || "Your previous cart selections couldn't be restored.");
            setFileFailures(mergeError?.fileFailures || []);
            setStaleUnverified(isPendingPurchaseStaleUnverified(getPendingPurchaseData()));
            setVisible(true);
            return;
        }
        // No pending data — check for a soft notice (merge succeeded
        // but files were trusted past a transient verify failure).
        const notice = readMergeNotice();
        if (notice) {
            setMode("notice");
            setVisible(true);
        }
    }, []);

    const handleRetry = useCallback(async () => {
        setRetrying(true);
        try {
            const result = await processPendingAddToCartIntent();
            if (result.success) {
                sessionStorage.removeItem(MERGE_ERROR_KEY);
                toastSuccess("Cart restored!");
                setVisible(false);
                onMerged?.();
                // Full reload so CartContext picks up the fresh item.
                window.location.reload();
                return;
            }
            const msg = result.error || "Still couldn't restore cart.";
            setErrorMessage(msg);
            setFileFailures(result.fileFailures || []);
            toastError(msg);
            writeMergeError({
                error: msg,
                at: Date.now(),
                fileFailures: result.fileFailures,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to restore cart.";
            setErrorMessage(msg);
            toastError(msg);
        } finally {
            setRetrying(false);
        }
    }, [onMerged]);

    const handleDismiss = useCallback(() => {
        // Only this explicit action clears the pending entry (issue #87
        // mandate: don't reset cart to empty until the user opts in).
        // Notice mode (merge succeeded, fail-open notice) has nothing
        // to clear from sessionStorage's pending entry — the merge
        // already wiped it — so this is a no-op there.
        if (mode === "error") {
            clearPendingPurchaseData();
        }
        try {
            sessionStorage.removeItem(MERGE_ERROR_KEY);
        } catch {
            /* ignore */
        }
        try {
            sessionStorage.removeItem(MERGE_NOTICE_KEY);
        } catch {
            /* ignore */
        }
        setVisible(false);
    }, [mode]);

    if (!visible) return null;

    // Notice mode (issue #94 fail-open): merge succeeded, files were
    // trusted past a transient FTP verify failure. Soft amber notice
    // with a single dismiss button — no retry, no per-file detail —
    // because the cart-page sweep + payment-init guard handle the
    // actual re-verify.
    if (mode === "notice") {
        return (
            <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-amber-900 mb-1">
                            We couldn't verify your files right now
                        </p>
                        <p className="text-xs sm:text-sm text-amber-800 break-words">
                            Your cart is restored. We'll verify your uploaded
                            files again on checkout — if anything's actually
                            missing, payment won't go through.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                onClick={handleDismiss}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-amber-700 bg-white border border-amber-300 hover:bg-amber-100"
                                type="button"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const hasFileDetail = fileFailures.length > 0;
    // Issue #94 — distinguish "all-transient" from "some files are
    // genuinely bad". The all-transient case gets a softer copy because
    // the cart-page sweep is about to re-verify, and the user shouldn't
    // be told their cart is broken when it's just a network blip.
    const allTransient = hasFileDetail && fileFailures.every((f) => !isHardFailure(f.reason));
    const heading = allTransient
        ? "Verifying your files… (retrying)"
        : "Couldn't restore your previous cart";

    return (
        <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-amber-900 mb-1">
                        {heading}
                    </p>
                    {hasFileDetail ? (
                        allTransient ? (
                            <p className="text-xs sm:text-sm text-amber-800 break-words">
                                A network blip held things up. We'll re-check
                                your files automatically — no action needed in
                                most cases. You can also use Retry below.
                            </p>
                        ) : (
                            <>
                                <p className="text-xs sm:text-sm text-amber-800 mb-2">
                                    Some uploaded files couldn't be verified:
                                </p>
                                <ul className="text-xs sm:text-sm text-amber-800 list-disc pl-5 space-y-0.5 break-words">
                                    {fileFailures.map((f, idx) => (
                                        <li key={`${f.name}-${idx}`}>
                                            <span className="font-medium">{f.name}</span>
                                            <span className="text-amber-700">
                                                {" "}— {describeVerifyReason(f.reason)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )
                    ) : (
                        <p className="text-xs sm:text-sm text-amber-800 break-words">
                            {errorMessage}
                        </p>
                    )}
                    {staleUnverified && (
                        <p className="mt-2 text-xs sm:text-sm text-amber-900 bg-amber-100 border border-amber-300 rounded px-2 py-1.5">
                            This restore has been pending for over an hour.
                            If retrying still doesn't help, discarding the
                            session and re-uploading is the fastest fix.
                        </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                            {retrying ? "Retrying..." : "Retry"}
                        </button>
                        <button
                            onClick={handleDismiss}
                            disabled={retrying}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-amber-700 bg-white border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
                            type="button"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Discard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
