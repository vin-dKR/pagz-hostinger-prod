"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import OtpInput from "../../components/auth/OtpInput";
import { PhoneIcon, PasswordIcon } from "../../components/icons";
import { resetPassword } from "../../../lib/api/auth";
import { toastPromise } from "../../../lib/utils/toast";

function isValidIndianPhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, "");
    const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    return /^[6-9]\d{9}$/.test(normalized);
}

export default function ResetPasswordPage() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
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

        if (!phone || !otp || !password || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }
        if (!isValidIndianPhone(phone)) {
            setError("Enter a valid 10-digit Indian mobile number");
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
                resetPassword(phone, otp, password),
                {
                    loading: "Resetting password...",
                    success: "Password reset successfully! Redirecting to login...",
                    error: (err) => err || "Failed to reset password.",
                }
            );
            if (response?.success) {
                setSuccess(true);
                setTimeout(() => router.push("/auth/login"), 2000);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to reset password.");
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
                            <p className="text-sm text-green-800 mb-2">Password reset successfully!</p>
                            <p className="text-xs text-green-700">Redirecting to login page...</p>
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
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                placeholder="Mobile Number (10 digits)"
                                required
                                icon={<PhoneIcon />}
                            />

                            <OtpInput value={otp} onChange={setOtp} disabled={loading} autoFocus={false} />

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
