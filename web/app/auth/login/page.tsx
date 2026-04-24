"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import { UserIcon, PasswordIcon } from "../../components/icons";
import { useAuth } from "../../../contexts/AuthContext";
import { parseLoginIdentifier } from "../../../lib/utils/login-identifier";

function LoginPageContent() {
    const { login } = useAuth();
    const searchParams = useSearchParams();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intent = searchParams.get("intent");
    const signupHref = intent ? `/auth/signup?intent=${encodeURIComponent(intent)}` : "/auth/signup";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const parsed = parseLoginIdentifier(identifier);
        if (!parsed) {
            setError("Enter a valid 10-digit mobile number or email");
            return;
        }

        setLoading(true);
        try {
            await login({ ...parsed, password });
        } catch (err: any) {
            setError(err.message || "Login failed. Please check your credentials.");
            setLoading(false);
        }
    };

    return (
        <AuthGuard>
            <AuthLayout
                title="Welcome to"
                subtitle={"PAGZ"}
                socialLogin={false}
                error={error}
            >
                <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
                    <AuthFormInput
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Mobile Number or Email"
                        required
                        autoComplete="username"
                        inputMode="email"
                        icon={<UserIcon />}
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

                <div className="relative mt-2 sm:mt-2.5">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                </div>

                <Link
                    href={signupHref}
                    className="mt-2 sm:mt-2.5 block w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm text-center"
                >
                    Create Account
                </Link>
            </AuthLayout>
        </AuthGuard>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginPageContent />
        </Suspense>
    );
}
