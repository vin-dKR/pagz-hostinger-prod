"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import OtpInput from "../../components/auth/OtpInput";
import { UserIcon, EmailIcon, PhoneIcon, PasswordIcon } from "../../components/icons";
import { useAuth } from "../../../contexts/AuthContext";
import { sendOtp } from "../../../lib/api/auth";
import { toastPromise } from "../../../lib/utils/toast";

type Step = "details" | "otp";

function isValidIndianPhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, "");
    const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    return /^[6-9]\d{9}$/.test(normalized);
}

function SignupPageContent() {
    const { register } = useAuth();
    const searchParams = useSearchParams();
    const [step, setStep] = useState<Step>("details");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
    });
    const [otp, setOtp] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intent = searchParams.get("intent");
    const loginHref = intent ? `/auth/login?intent=${encodeURIComponent(intent)}` : "/auth/login";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === "phone") {
            setFormData({ ...formData, phone: value.replace(/\D/g, "").slice(0, 10) });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleDetailsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.name.trim()) {
            setError("Name is required");
            return;
        }
        if (!formData.phone || !isValidIndianPhone(formData.phone)) {
            setError("Enter a valid 10-digit Indian mobile number");
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (formData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                setError("Invalid email format");
                return;
            }
        }
        if (!agreeToTerms) {
            setError("Please agree to the terms and conditions");
            return;
        }

        setLoading(true);
        try {
            const response = await sendOtp(formData.phone, "SIGNUP");
            if (!response.success) {
                setError(response.error || "Failed to send OTP");
                setLoading(false);
                return;
            }
            toastPromise(
                Promise.resolve(response),
                {
                    loading: "Sending OTP...",
                    success: "OTP sent to your mobile. Please check SMS.",
                    error: (err) => err || "Failed to send OTP.",
                }
            );
            setStep("otp");
        } catch (err: any) {
            setError(err.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!otp || otp.length !== 6) {
            setError("Please enter the 6-digit OTP");
            return;
        }

        setLoading(true);
        try {
            await register({
                phone: formData.phone,
                password: formData.password,
                otp,
                name: formData.name.trim(),
                email: formData.email || undefined,
            });
        } catch (err: any) {
            setError(err.message || "Registration failed. Please try again.");
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        setError(null);
        setLoading(true);
        try {
            const response = await sendOtp(formData.phone, "SIGNUP");
            if (!response.success) {
                setError(response.error || "Failed to resend OTP");
            } else {
                toastPromise(Promise.resolve(response), {
                    loading: "Sending OTP...",
                    success: "OTP sent again",
                    error: (err) => err || "Failed",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthGuard>
            <AuthLayout
                title={step === "details" ? "Create Account" : "Verify Mobile"}
                subtitle={step === "details" ? "Join PAGZ today" : `OTP sent to +91 ${formData.phone}`}
                socialLogin={false}
                error={error}
            >
                {step === "details" && (
                    <form onSubmit={handleDetailsSubmit} className="space-y-2 sm:space-y-2.5">
                        <AuthFormInput
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Full Name"
                            required
                            icon={<UserIcon />}
                        />

                        <AuthFormInput
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Mobile Number (10 digits)"
                            required
                            icon={<PhoneIcon />}
                        />

                        <AuthFormInput
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Email (optional)"
                            icon={<EmailIcon />}
                        />

                        <AuthFormInput
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            required
                            icon={<PasswordIcon />}
                            showPasswordToggle
                            showPassword={showPassword}
                            onTogglePassword={() => setShowPassword(!showPassword)}
                        />

                        <AuthFormInput
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm Password"
                            required
                            icon={<PasswordIcon />}
                            showPasswordToggle
                            showPassword={showConfirmPassword}
                            onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                        />

                        <div className="flex items-start gap-1.5 pt-0.5">
                            <input
                                type="checkbox"
                                checked={agreeToTerms}
                                onChange={(e) => setAgreeToTerms(e.target.checked)}
                                className="w-3.5 h-3.5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
                            />
                            <label className="text-xs text-gray-700 leading-tight">
                                I agree to the{" "}
                                <Link href="/terms" className="text-blue-600 hover:underline">
                                    Terms & Conditions
                                </Link>{" "}
                                and{" "}
                                <Link href="/privacy" className="text-blue-600 hover:underline">
                                    Privacy Policy
                                </Link>
                            </label>
                        </div>

                        <AuthFormButton loading={loading}>
                            Send OTP
                        </AuthFormButton>
                    </form>
                )}

                {step === "otp" && (
                    <form onSubmit={handleOtpSubmit} className="space-y-3 sm:space-y-3.5">
                        <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                        <AuthFormButton loading={loading}>
                            Verify & Create Account
                        </AuthFormButton>

                        <div className="flex items-center justify-between pt-1 text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("details");
                                    setOtp("");
                                    setError(null);
                                }}
                                className="text-gray-600 hover:underline"
                            >
                                Change details
                            </button>
                            <button
                                type="button"
                                onClick={resendOtp}
                                disabled={loading}
                                className="text-blue-600 hover:text-blue-700 font-medium hover:underline disabled:opacity-50"
                            >
                                Resend OTP
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-2 sm:mt-2.5 text-center text-xs text-gray-600">
                    Already have an account?{" "}
                    <Link href={loginHref} className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                        Sign In
                    </Link>
                </div>
            </AuthLayout>
        </AuthGuard>
    );
}

export default function SignupPage() {
    return (
        <Suspense fallback={null}>
            <SignupPageContent />
        </Suspense>
    );
}
