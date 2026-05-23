"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import {
    clearRedirectPath,
    getAuthIntentFromSearch,
    getRedirectPath,
} from "../../../lib/utils/auth-redirect";
import { processPendingAddToCartIntent } from "../../../lib/utils/pending-cart-intent";
import { hasPendingPurchaseData } from "../../../lib/utils/pending-purchase";
import { toastError } from "../../../lib/utils/toast";

const MERGE_ERROR_KEY = "pendingMergeError";
/**
 * Issue #94 — soft notice key set when the post-login merge SUCCEEDED
 * but one or more files came back transient from the FTP verify and we
 * fail-opened the restore. The cart page reads this on mount and renders
 * an amber soft notice ("we couldn't verify your files right now — your
 * cart is restored. We'll verify again on checkout.") instead of the
 * hard error banner shown for genuine failures.
 */
const MERGE_NOTICE_KEY = "pendingMergeNotice";

/**
 * AuthGuard
 *
 * Wraps the /auth/* pages.
 *   - While auth state is resolving: shows a loading spinner.
 *   - If user is authenticated and we have a pending guest cart intent
 *     (either via ?intent=add_to_cart or leftover sessionStorage): runs
 *     processPendingAddToCartIntent to merge the item into the real cart,
 *     then redirects to the saved redirect path (or /cart as a fallback).
 *     While merging, renders a dedicated spinner so the page isn't blank.
 *   - Otherwise: redirects authenticated users away from the login/signup
 *     page to the saved redirect path, or / as a last resort.
 *   - If not authenticated: renders children (login/signup form).
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();
    const redirectHandledRef = useRef(false);
    const [merging, setMerging] = useState(false);

    useEffect(() => {
        if (loading || redirectHandledRef.current) return;

        if (!isAuthenticated) return;

        redirectHandledRef.current = true;

        const timer = setTimeout(() => {
            const handleAuthenticatedRedirect = async () => {
                const redirectPath = getRedirectPath();
                const authIntent = getAuthIntentFromSearch();
                const shouldProcessPending =
                    authIntent === "add_to_cart" || hasPendingPurchaseData();

                if (shouldProcessPending) {
                    setMerging(true);
                    const result = await processPendingAddToCartIntent();
                    if (result.handled) {
                        clearRedirectPath();
                        if (result.success) {
                            try {
                                sessionStorage.removeItem(MERGE_ERROR_KEY);
                            } catch {
                                /* ignore */
                            }
                            // Fail-open notice: merge succeeded but files
                            // came back transient from FTP verify. The
                            // cart page renders a soft amber banner so
                            // the user knows their files weren't verified
                            // — payment-init will re-verify before charging.
                            if (result.verifyFellOpen) {
                                try {
                                    sessionStorage.setItem(
                                        MERGE_NOTICE_KEY,
                                        JSON.stringify({
                                            kind: "verify-fell-open",
                                            at: Date.now(),
                                        }),
                                    );
                                } catch {
                                    /* ignore */
                                }
                            } else {
                                try {
                                    sessionStorage.removeItem(MERGE_NOTICE_KEY);
                                } catch {
                                    /* ignore */
                                }
                            }
                            window.location.href = redirectPath || "/cart";
                        } else {
                            const errorMessage =
                                result.error || "Failed to restore your cart item.";
                            try {
                                // Persist per-file failure detail alongside the
                                // top-level message so the banner can render
                                // filename + reason instead of a generic
                                // "couldn't restore" (issue #87).
                                sessionStorage.setItem(
                                    MERGE_ERROR_KEY,
                                    JSON.stringify({
                                        error: errorMessage,
                                        at: Date.now(),
                                        fileFailures: result.fileFailures,
                                    })
                                );
                            } catch {
                                /* ignore */
                            }
                            toastError(errorMessage);
                            window.location.href = "/cart";
                        }
                        return;
                    }
                    setMerging(false);
                }

                if (redirectPath) {
                    clearRedirectPath();
                    window.location.href = redirectPath;
                } else {
                    router.replace("/");
                }
            };

            void handleAuthenticatedRedirect();
        }, 100);

        return () => clearTimeout(timer);
    }, [isAuthenticated, loading, router]);

    if (loading) {
        return <AuthSpinner label="Loading..." />;
    }

    if (isAuthenticated) {
        return (
            <AuthSpinner
                label={merging ? "Restoring your cart..." : "Signing you in..."}
            />
        );
    }

    return <>{children}</>;
}

function AuthSpinner({ label }: { label: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                <p className="text-gray-600">{label}</p>
            </div>
        </div>
    );
}
