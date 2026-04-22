"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import {
    clearRedirectPath,
    getAuthIntentFromSearch,
    getRedirectPath,
} from "../../../lib/utils/auth-redirect";
import { processPendingAddToCartIntent } from "../../../lib/utils/pending-cart-intent";
import { toastError } from "../../../lib/utils/toast";

/**
 * AuthGuard Component
 * Redirects authenticated users away from auth pages (login/signup)
 * to prevent logged-in users from accessing authentication pages
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();
    const redirectHandledRef = useRef(false);

    useEffect(() => {
        // Wait for auth state to be determined
        if (loading || redirectHandledRef.current) return;

        // If user is authenticated, check for saved redirect path
        if (isAuthenticated) {
            redirectHandledRef.current = true;
            // Small delay to ensure auth state is fully updated
            const timer = setTimeout(() => {
                const handleAuthenticatedRedirect = async () => {
                    const redirectPath = getRedirectPath();
                    const authIntent = getAuthIntentFromSearch();

                    if (authIntent === "add_to_cart") {
                        const result = await processPendingAddToCartIntent();
                        if (result.handled) {
                            clearRedirectPath();
                            if (result.success) {
                                // Prefer the originally requested destination
                                // (e.g. `/checkout?items=...` when the user
                                // clicked Checkout from the guest cart).
                                // Fall back to `/cart` so returning users
                                // still see their merged item.
                                //
                                // Full reload avoids stale cart context
                                // initialised pre-token.
                                window.location.href = redirectPath || "/cart";
                            } else {
                                toastError(result.error || "Failed to restore your cart item.");
                                if (redirectPath) {
                                    window.location.href = redirectPath;
                                } else {
                                    router.replace("/");
                                }
                            }
                            return;
                        }
                    }

                    if (redirectPath) {
                        clearRedirectPath();
                        // Use window.location for full page reload to ensure proper navigation
                        window.location.href = redirectPath;
                    } else {
                        router.replace("/");
                    }
                };

                void handleAuthenticatedRedirect();
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, loading, router]);

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render children if user is authenticated (will redirect)
    if (isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}

