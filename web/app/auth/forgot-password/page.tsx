"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import { EmailIcon, PasswordIcon } from "../../components/icons";
import { forgotPassword, verifyOTP, resetPassword } from "../../../lib/api/auth";
import { toastPromise } from "../../../lib/utils/toast";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email) {
            setError("Email is required");
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address");
            return;
        }

        setLoading(true);

        try {
            const response = await forgotPassword(email);

            if (response?.success) {
                // Check if user needs to sign up
                if (response.data?.requiresSignup) { 
                    setError(response.data.message || "No account found with this email. Please create an account first.");
                    setLoading(false);
                    return;
                }

                // Show toast and move to OTP step
                toastPromise(
                    Promise.resolve(response),
                    {
                        loading: 'Sending OTP...',
                        success: 'OTP sent to your email! Please check your inbox.',
                        error: (err) => err || 'Failed to send OTP. Please try again.',
                    }
                );
                setStep("otp");
            } else {
                setError(response?.error || "Failed to send OTP. Please try again.");
            }
        } catch (err: any) {
            console.error('Forgot password error:', err);
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
            const response = await verifyOTP(email, otp);

            if (response?.success) {
                toastPromise(
                    Promise.resolve(response),
                    {
                        loading: 'Verifying OTP...',
                        success: 'OTP verified successfully!',
                        error: (err) => err || 'Failed to verify OTP. Please try again.',
                    }
                );
                setStep("password");
            } else {
                setError(response?.error || "Invalid or expired OTP. Please try again.");
            }
        } catch (err: any) {
            console.error('Verify OTP error:', err);
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
                resetPassword(email, otp, password),
                {
                    loading: 'Resetting password...',
                    success: 'Password reset successfully! Redirecting to login...',
                    error: (err) => err || 'Failed to reset password. Please try again.',
                }
            );

            if (response?.success) {
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push("/auth/login");
                }, 2000);
            }
        } catch (err: any) {
            console.error('Reset password error:', err);
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
                    step === "email" ? "Enter your email to receive OTP" :
                    step === "otp" ? "Enter the OTP sent to your email" :
                    "Enter your new password"
                }
                socialLogin={false}
                error={error}
            >
                {step === "email" && (
                    <>
                        <form onSubmit={handleEmailSubmit} className="space-y-2 sm:space-y-2.5">
                            <AuthFormInput
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="example@gmail.com"
                                required
                                icon={<EmailIcon />}
                            />

                            <AuthFormButton loading={loading}>
                                Send OTP
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

                {step === "otp" && (
                    <>
                        <form onSubmit={handleOTPSubmit} className="space-y-2 sm:space-y-2.5">
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

                            <AuthFormButton loading={loading}>
                                Verify OTP
                            </AuthFormButton>
                        </form>

                        {/* Resend OTP Link */}
                        <div className="mt-2 sm:mt-2.5 text-center text-xs text-gray-600">
                            Didn't receive OTP?{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("email");
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
