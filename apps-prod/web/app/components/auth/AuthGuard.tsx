"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { getRedirectPath, clearRedirectPath } from "../../../lib/utils/auth-redirect";

/**
 * AuthGuard Component
 * Redirects authenticated users away from auth pages (login/signup)
 * to prevent logged-in users from accessing authentication pages
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        // Wait for auth state to be determined
        if (loading) return;

        // If user is authenticated, check for saved redirect path
        if (isAuthenticated) {
            // Small delay to ensure auth state is fully updated
            const timer = setTimeout(() => {
                const redirectPath = getRedirectPath();
                if (redirectPath) {
                    console.log('[AuthGuard] Redirecting to saved path:', redirectPath);
                    clearRedirectPath();
                    // Use window.location for full page reload to ensure proper navigation
                    window.location.href = redirectPath;
                } else {
                    console.log('[AuthGuard] No redirect path found, redirecting to /home');
                    router.replace("/home");
                }
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

