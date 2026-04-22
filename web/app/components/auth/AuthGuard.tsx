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
                            window.location.href = redirectPath || "/cart";
                        } else {
                            const errorMessage =
                                result.error || "Failed to restore your cart item.";
                            try {
                                sessionStorage.setItem(
                                    MERGE_ERROR_KEY,
                                    JSON.stringify({ error: errorMessage, at: Date.now() })
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
