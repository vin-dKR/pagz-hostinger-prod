"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import Link from "next/link";

interface ProtectedRouteProps {
    children: React.ReactNode;
    redirectTo?: string;
}

export default function ProtectedRoute({
    children,
    redirectTo = "/auth/login"
}: ProtectedRouteProps) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            // Store the current path to redirect back after login
            const currentPath = window.location.pathname;
            if (currentPath !== redirectTo) {
                sessionStorage.setItem("redirectAfterLogin", currentPath);
            }
            router.push(redirectTo);
        }
    }, [isAuthenticated, loading, router, redirectTo]);

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

    // Show login prompt if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                    <div className="mb-6">
                        <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <svg
                                className="w-10 h-10 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Authentication Required
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Please log in to access this page. You need to be signed in to view this content.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Link
                            href="/auth/login"
                            className="block w-full px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/auth/signup"
                            className="block w-full px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                        >
                            Create Account
                        </Link>
                    </div>

                    <p className="mt-6 text-sm text-gray-500">
                        Don't have an account?{" "}
                        <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                            Sign up here
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    // Render protected content if authenticated
    return <>{children}</>;
}

