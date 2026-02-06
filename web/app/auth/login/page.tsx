"use client";

import { useState } from "react";
import Link from "next/link";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import { EmailIcon, PasswordIcon } from "../../components/icons"
import { useAuth } from "../../../contexts/AuthContext";
import { signInWithGoogle, signInWithFacebook } from "../../../lib/supabase";

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Note: Redirect is handled by AuthGuard component after authentication
    // AuthGuard will check for saved redirect path and redirect accordingly

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await login(email, password);
            // AuthGuard will handle redirect after isAuthenticated becomes true
            // No need to set shouldRedirect flag
        } catch (err: any) {
            setError(err.message || "Login failed. Please check your credentials.");
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError(null);
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || "Google sign in failed. Please try again.");
        }
    };

    const handleFacebookLogin = async () => {
        try {
            setError(null);
            await signInWithFacebook();
        } catch (err: any) {
            setError(err.message || "Facebook sign in failed. Please try again.");
        }
    };

    return (
        <AuthGuard>
            <AuthLayout
                title="Welcome to"
                subtitle={"PAGZ"}
                onGoogleAuth={handleGoogleLogin}
                onFacebookAuth={handleFacebookLogin}
                error={error}
            >
                <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
                    <AuthFormInput
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        required
                        icon={<EmailIcon />}
                    />

                    <AuthFormInput
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        icon={<PasswordIcon />}
                        showPasswordToggle
                        showPassword={showPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                    />

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between pt-0.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">Remember me</span>
                        </label>
                        <Link
                            href="/auth/forgot-password"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            Forgot Password?
                        </Link>
                    </div>

                    <AuthFormButton loading={loading}>
                        Login
                    </AuthFormButton>
                </form>

                {/* Register Link */}
                <div className="mt-2 sm:mt-2.5 text-center text-xs text-gray-600">
                    Don't have an account?{" "}
                    <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                        Register
                    </Link>
                </div>
            </AuthLayout>
        </AuthGuard>
    );
}
