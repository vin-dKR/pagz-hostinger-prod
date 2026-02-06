export default function LoginIllustration() {
    return (
        <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 h-full relative overflow-hidden">
            {/* Decorative shapes */}
            <div className="absolute top-20 left-10 w-32 h-32 bg-pink-200 rounded-full opacity-30 blur-2xl"></div>
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-200 rounded-full opacity-30 blur-2xl"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-purple-300 rounded-full opacity-20 blur-xl"></div>

            {/* Large Padlock in background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 text-pink-200 opacity-30">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>

            {/* Main illustration content */}
            <div className="relative z-10 flex items-end justify-center gap-8">
                {/* Person figure */}
                <div className="relative flex flex-col items-center">
                    {/* Head */}
                    <div className="w-20 h-20 bg-purple-600 rounded-full mb-2 relative z-10"></div>
                    {/* Body - Shirt */}
                    <div className="w-28 h-40 bg-purple-700 rounded-t-3xl relative z-10"></div>
                    {/* Pants */}
                    <div className="w-28 h-16 bg-gray-800 rounded-b-2xl -mt-2"></div>
                    {/* Left arm pointing */}
                    <div className="absolute -right-6 top-12 w-10 h-32 bg-purple-700 rounded-full transform rotate-12 origin-top"></div>
                </div>

                {/* Phone */}
                <div className="relative">
                    <div className="w-40 h-64 bg-white rounded-[2.5rem] shadow-2xl p-3">
                        {/* Phone screen */}
                        <div className="w-full h-full bg-orange-400 rounded-[2rem] flex flex-col items-center justify-center p-6">
                            {/* User icon on phone */}
                            <div className="w-20 h-20 bg-white rounded-full mb-6"></div>
                            <div className="w-full h-3 bg-white rounded-full mb-3"></div>
                            <div className="w-3/4 h-3 bg-white rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
