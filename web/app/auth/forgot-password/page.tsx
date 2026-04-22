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
import { forgotPassword, verifyOTP, resetPassword } from "../../../lib/api/auth";
import { toastPromise } from "../../../lib/utils/toast";

type Step = "phone" | "otp" | "password";

function isValidIndianPhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, "");
    const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    return /^[6-9]\d{9}$/.test(normalized);
}

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isValidIndianPhone(phone)) {
            setError("Enter a valid 10-digit Indian mobile number");
            return;
        }

        setLoading(true);
        try {
            const response = await forgotPassword(phone);
            if (response?.success) {
                if (response.data?.requiresSignup) {
                    setError(response.data.message || "No account found with this mobile. Please sign up.");
                    setLoading(false);
                    return;
                }
                toastPromise(
                    Promise.resolve(response),
                    {
                        loading: "Sending OTP...",
                        success: "OTP sent to your mobile.",
                        error: (err) => err || "Failed to send OTP.",
                    }
                );
                setStep("otp");
            } else {
                setError(response?.error || "Failed to send OTP. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!otp || otp.length !== 6) {
            setError("Please enter a valid 6-digit OTP");
            return;
        }

        setLoading(true);
        try {
            const response = await verifyOTP(phone, otp, "RESET_PASSWORD");
            if (response?.success) {
                toastPromise(
                    Promise.resolve(response),
                    {
                        loading: "Verifying OTP...",
                        success: "OTP verified",
                        error: (err) => err || "Failed to verify OTP.",
                    }
                );
                setStep("password");
            } else {
                setError(response?.error || "Invalid or expired OTP. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to verify OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password || !confirmPassword) {
            setError("Please fill in all fields");
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
                setTimeout(() => router.push("/auth/login"), 2000);
            }
        } catch (err: any) {
            setError(err.message || "Failed to reset password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthGuard>
            <AuthLayout
                title="Forgot Password"
                subtitle={
                    step === "phone" ? "Enter your mobile to receive OTP" :
                    step === "otp" ? `OTP sent to +91 ${phone}` :
                    "Enter your new password"
                }
                socialLogin={false}
                error={error}
            >
                {step === "phone" && (
                    <>
                        <form onSubmit={handlePhoneSubmit} className="space-y-2 sm:space-y-2.5">
                            <AuthFormInput
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                placeholder="Mobile Number (10 digits)"
                                required
                                icon={<PhoneIcon />}
                            />

                            <AuthFormButton loading={loading}>
                                Send OTP
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

                {step === "otp" && (
                    <>
                        <form onSubmit={handleOTPSubmit} className="space-y-3 sm:space-y-3.5">
                            <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                            <AuthFormButton loading={loading}>
                                Verify OTP
                            </AuthFormButton>
                        </form>

                        <div className="mt-2 sm:mt-2.5 text-center text-xs text-gray-600">
                            Didn't receive OTP?{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("phone");
                                    setOtp("");
                                    setError(null);
                                }}
                                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                            >
                                Resend
                            </button>
                        </div>
                    </>
                )}

                {step === "password" && (
                    <>
                        <form onSubmit={handlePasswordSubmit} className="space-y-2 sm:space-y-2.5">
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
