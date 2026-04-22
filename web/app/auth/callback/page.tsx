"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy OAuth callback. Phone-OTP auth does not use OAuth; redirect to login.
 */
export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/auth/login");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Redirecting...</p>
            </div>
        </div>
    );
}
