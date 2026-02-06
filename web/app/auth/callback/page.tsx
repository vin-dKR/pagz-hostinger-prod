"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { setAuthToken } from "../../../lib/api-client";
import { useAuth } from "../../../contexts/AuthContext";
import { getRedirectPath, clearRedirectPath } from "../../../lib/utils/auth-redirect";

/**
 * OAuth Callback Page
 * Handles the redirect after Google/Facebook OAuth
 */
export default function AuthCallbackPage() {
    const router = useRouter();
    const { refreshUser } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            if (!supabase) {
                router.push("/auth/login?error=supabase_not_configured");
                return;
            }

            try {
                // Get the session from Supabase after OAuth redirect
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Error getting session:", error);
                    router.push("/auth/login?error=auth_failed");
                    return;
                }

                if (session?.access_token) {
                    // Store the token
                    setAuthToken(session.access_token);

                    // Fetch the user profile to populate the auth context
                    await refreshUser();

                    // Check for saved redirect path
                    const redirectPath = getRedirectPath();
                    if (redirectPath) {
                        clearRedirectPath();
                        window.location.href = redirectPath;
                    } else {
                        // Redirect to home page
                        window.location.href = "/";
                    }
                } else {
                    router.push("/auth/login?error=no_session");
                }
            } catch (error) {
                console.error("Callback error:", error);
                router.push("/auth/login?error=callback_failed");
            }
        };

        handleCallback();
    }, [router, refreshUser]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Completing sign in...</p>
            </div>
        </div>
    );
}

