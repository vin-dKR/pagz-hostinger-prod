"use client";

import { useState } from "react";
import Link from "next/link";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthFormInput from "../../components/auth/AuthFormInput";
import AuthFormButton from "../../components/auth/AuthFormButton";
import AuthGuard from "../../components/auth/AuthGuard";
import { UserIcon, EmailIcon, PhoneIcon, PasswordIcon } from "../../components/icons"
import { useAuth } from "../../../contexts/AuthContext";
import { signInWithGoogle, signInWithFacebook } from "../../../lib/supabase";

export default function SignupPage() {
    const { register } = useAuth();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Note: Redirect is handled by AuthGuard component after authentication
    // AuthGuard will check for saved redirect path and redirect accordingly

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        if (!agreeToTerms) {
            setError("Please agree to the terms and conditions");
            return;
        }

        setLoading(true);

        try {
            await register(
                formData.email,
                formData.password,
                formData.name || undefined,
                formData.phone || undefined
            );
            // AuthGuard will handle redirect after isAuthenticated becomes true
            // No need to set shouldRedirect flag
        } catch (err: any) {
            setError(err.message || "Registration failed. Please try again.");
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        try {
            setError(null);
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || "Google sign up failed. Please try again.");
        }
    };

    const handleFacebookSignup = async () => {
        try {
            setError(null);
            await signInWithFacebook();
        } catch (err: any) {
            setError(err.message || "Facebook sign up failed. Please try again.");
        }
    };

    return (
        <AuthGuard>
            <AuthLayout
                title="Create Account"
                subtitle="Join PAGZ today"
                onGoogleAuth={handleGoogleSignup}
                onFacebookAuth={handleFacebookSignup}
                error={error}
            >
                <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
                    <AuthFormInput
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Full Name (optional)"
                        icon={<UserIcon />}
                    />

                    <AuthFormInput
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="example@gmail.com"
                        required
                        icon={<EmailIcon />}
                    />

                    <AuthFormInput
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Phone Number (optional)"
                        icon={<PhoneIcon />}
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

                    {/* Terms & Conditions */}
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
                        Create Account
                    </AuthFormButton>
                </form>

                {/* Login Link */}
                <div className="mt-2 sm:mt-2.5 text-center text-xs text-gray-600">
                    Already have an account?{" "}
                    <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                        Sign In
                    </Link>
                </div>
            </AuthLayout>
        </AuthGuard>
    );
}
