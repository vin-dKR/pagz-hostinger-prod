"use client";

/**
 * PendingMergeBanner
 *
 * Shown on /cart when an authenticated user still has a pending guest-cart
 * item in sessionStorage that failed to merge on login. Gives them a visible
 * error and a Retry button so they don't lose their selections silently.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import {
    clearPendingPurchaseData,
    hasPendingPurchaseData,
} from "@/lib/utils/pending-purchase";
import { processPendingAddToCartIntent } from "@/lib/utils/pending-cart-intent";
import { toastError, toastSuccess } from "@/lib/utils/toast";

const MERGE_ERROR_KEY = "pendingMergeError";

interface MergeError {
    error: string;
    at: number;
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

export default function PendingMergeBanner({ onMerged }: { onMerged?: () => void }) {
    const [visible, setVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        if (!hasPendingPurchaseData()) return;
        const mergeError = readMergeError();
        setErrorMessage(mergeError?.error || "Your previous cart selections couldn't be restored.");
        setVisible(true);
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
            toastError(msg);
            try {
                sessionStorage.setItem(
                    MERGE_ERROR_KEY,
                    JSON.stringify({ error: msg, at: Date.now() })
                );
            } catch {
                /* ignore */
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to restore cart.";
            setErrorMessage(msg);
            toastError(msg);
        } finally {
            setRetrying(false);
        }
    }, [onMerged]);

    const handleDismiss = useCallback(() => {
        clearPendingPurchaseData();
        try {
            sessionStorage.removeItem(MERGE_ERROR_KEY);
        } catch {
            /* ignore */
        }
        setVisible(false);
    }, []);

    if (!visible) return null;

    return (
        <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-amber-900 mb-1">
                        Couldn't restore your previous cart
                    </p>
                    <p className="text-xs sm:text-sm text-amber-800 break-words">
                        {errorMessage}
                    </p>
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
