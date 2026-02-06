export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                {/* Header Section */}
                <div className="text-center mb-12 sm:mb-16">
                    {/* About Us Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200 mb-6">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">ABOUT US</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
                        Professional Printing Solutions
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg sm:text-xl text-gray-600 font-light max-w-3xl mx-auto">
                        We're building the modern printing experience for businesses and individuals
                    </p>
                </div>

                {/* Our Mission Section */}
                <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 md:p-10 mb-12 sm:mb-16">
                    <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
                        {/* Icon */}
                        <div className="shrink-0">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#008ECC] rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
                            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                PAGZ is a modern printing service provider built for businesses and individuals who need quality printing, lamination, scanning, and spiral binding solutions. With 25 years of dedicated service in the photocopy industry, we have been providing top-tier services to our customers. Our commitment to quality and customer satisfaction sets us apart from the competition.
                            </p>
                        </div>
                    </div>
                </div>

                {/* What We Do Section */}
                <div className="text-center mb-12 sm:mb-16">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">What We Do</h2>
                    <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
                        It's not just printing — it's a comprehensive printing solution that helps you with quality prints, professional lamination, efficient scanning, and perfect binding — all from one reliable, secure, and easy-to-use service.
                    </p>
                </div>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12">
                    {/* Card 1: Quality Printing */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-100 hover:border-[#008ECC]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#008ECC]/10 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Quality Printing</h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                            Advanced machines and true-toned ink ensure the highest quality prints every time
                        </p>
                    </div>

                    {/* Card 2: Professional Lamination */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-100 hover:border-[#008ECC]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#008ECC]/10 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional Lamination</h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                            Protect and enhance your documents with our professional lamination services
                        </p>
                    </div>

                    {/* Card 3: Efficient Scanning */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-100 hover:border-[#008ECC]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#008ECC]/10 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Efficient Scanning</h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                            High-quality scanning services to digitize your documents quickly and accurately
                        </p>
                    </div>

                    {/* Card 4: Perfect Binding */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-100 hover:border-[#008ECC]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#008ECC]/10 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Perfect Binding</h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                            Spiral binding and professional finishing for all your document needs
                        </p>
                    </div>

                    {/* Card 5: Advanced Technology */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-100 hover:border-[#008ECC]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#008ECC]/10 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Advanced Technology</h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                            Regularly updated machines and systems for better enhancement in work
                        </p>
                    </div>

                    {/* Card 6: Customer Focus */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-gray-100 hover:border-[#008ECC]/20 transition-colors">
                        <div className="w-12 h-12 bg-[#008ECC]/10 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Customer Focus</h3>
                        <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                            Building lasting relationships through exceptional service and satisfaction
                        </p>
                    </div>
                </div>

                {/* Entity Information */}
                <div className="text-center pt-8 border-t border-gray-200">
                    <p className="text-sm sm:text-base text-gray-500">
                        This business is an entity of <span className="text-gray-700 font-medium">PAGZ PRINTS PRIVATE</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}
