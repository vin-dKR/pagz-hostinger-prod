import Image from "next/image";
import SocialLoginButton from "../SocialLoginButton";

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    socialLogin?: boolean;
    onGoogleAuth?: () => void;
    onFacebookAuth?: () => void;
    error?: string | null;
}

export default function AuthLayout({
    children,
    title,
    subtitle,
    socialLogin = true,
    onGoogleAuth,
    onFacebookAuth,
    error
}: AuthLayoutProps) {
    return (
        <div className="bg-white flex items-center justify-center h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] md:h-[calc(100vh-180px)] overflow-hidden">
            <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-full flex items-center justify-center py-2 sm:py-4">
                <div className="bg-[#F4F4F4] w-full rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden h-full max-h-full lg:max-h-none">
                    <div className="flex flex-col lg:flex-row w-full h-full max-h-full lg:max-h-none">
                        {/* Left Side - Illustration - Hidden on mobile */}
                        <div className="hidden lg:flex lg:w-1/2 p-4 md:p-6 lg:p-8 xl:p-10 items-center justify-center overflow-y-auto">
                            <div className="w-full max-w-lg mx-auto">
                                <div className="relative w-full aspect-square lg:aspect-4/3 max-h-[300px] md:max-h-[350px] lg:max-h-[300px] 2xl:max-h-[400px] flex items-center justify-center">
                                    <Image
                                        src="/images/auth-illustration.svg"
                                        alt="Authentication illustration showing secure login"
                                        fill
                                        className="object-contain"
                                        sizes="(max-width: 768px) 90vw, 40vw"
                                        priority
                                    />
                                </div>
                                {/* Optional decorative elements */}
                                <div className="mt-4 md:mt-6 lg:mt-8 text-center">
                                    <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-800 mb-1 md:mb-2">Welcome to PAGZ</h3>
                                    <p className="text-xs md:text-sm lg:text-base text-gray-600 max-w-md mx-auto">
                                        Create custom designs and bring your imagination to life
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Form - Full width on mobile, half on desktop - Centered on smaller devices */}
                        <div className="w-full lg:w-1/2 p-2 sm:p-3 md:p-4 lg:p-6 flex items-center justify-center bg-[#F4F4F4] min-h-full lg:min-h-0">
                            <div className="w-full max-w-md bg-white p-2.5 sm:p-3 md:p-4 lg:p-5 rounded-lg sm:rounded-xl shadow-sm">
                                {/* Header */}
                                <div className="text-center mb-2.5 sm:mb-3 md:mb-4">
                                    <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-0.5">{title}</h1>
                                    {subtitle && <h2 className="text-xs sm:text-sm md:text-base text-gray-600 mt-0.5">{subtitle}</h2>}
                                </div>

                                {/* Social Login Buttons */}
                                {socialLogin && onGoogleAuth && onFacebookAuth && (
                                    <>
                                        <div className="flex flex-row gap-1.5 sm:gap-2 md:gap-2.5 mb-2 sm:mb-2.5 md:mb-3">
                                            <SocialLoginButton provider="google" onClick={onGoogleAuth} />
                                            <SocialLoginButton provider="facebook" onClick={onFacebookAuth} />
                                        </div>

                                        {/* Separator */}
                                        <div className="relative mb-2 sm:mb-2.5 md:mb-3">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-gray-300"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs">
                                                <span className="px-2 bg-white text-gray-500">OR</span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <div className="mb-2 sm:mb-2.5 p-1.5 sm:p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                                        {error}
                                    </div>
                                )}

                                {/* Form Content */}
                                <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
