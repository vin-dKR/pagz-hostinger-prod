"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import { EmailIcon, PasswordIcon } from "../../components/icons";
import { resetPassword } from "../../../lib/api/auth";
import { toastPromise } from "../../../lib/utils/toast";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email || !otp || !password || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address");
            return;
        }

        if (otp.length !== 6) {
            setError("OTP must be 6 digits");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        setLoading(true);

        try {
            const response = await toastPromise(
                resetPassword(email, otp, password),
                {
                    loading: 'Resetting password...',
                    success: 'Password reset successfully! Redirecting to login...',
                    error: (err) => err || 'Failed to reset password. Please try again.',
                }
            );

            if (response?.success) {
                setSuccess(true);
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push("/auth/login");
                }, 2000);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthGuard>
            <AuthLayout
                title="Reset Password"
                subtitle="Enter your new password"
                socialLogin={false}
                error={error}
            >
                {success ? (
                    <div className="space-y-4 text-center">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800 mb-2">
                                Password reset successfully!
                            </p>
                            <p className="text-xs text-green-700">
                                Redirecting to login page...
                            </p>
                        </div>
                        <Link
                            href="/auth/login"
                            className="inline-block text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        >
                            Go to Login
                        </Link>
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
                            <AuthFormInput
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email Address"
                                required
                                icon={<EmailIcon />}
                            />

                            <div className="relative">
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => {
                                        // Only allow numbers and limit to 6 digits
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setOtp(value);
                                    }}
                                    placeholder="Enter 6-digit OTP"
                                    required
                                    maxLength={6}
                                    className="w-full px-4 py-2 text-center text-2xl tracking-widest font-mono bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <AuthFormInput
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="New Password"
                                required
                                icon={<PasswordIcon />}
                                showPasswordToggle
                                showPassword={showPassword}
                                onTogglePassword={() => setShowPassword(!showPassword)}
                            />

                            <AuthFormInput
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm New Password"
                                required
                                icon={<PasswordIcon />}
                                showPasswordToggle
                                showPassword={showConfirmPassword}
                                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                            />

                            <AuthFormButton loading={loading}>
                                Reset Password
                            </AuthFormButton>
                        </form>

                        {/* Back to Login Link */}
                        <div className="mt-2 sm:mt-2.5 text-center text-xs text-gray-600">
                            Remember your password?{" "}
                            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                                Sign In
                            </Link>
                        </div>
                    </>
                )}
            </AuthLayout>
        </AuthGuard>
    );
}
