export default function ReturnPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                {/* Header Section */}
                <div className="text-center mb-12 sm:mb-16">
                    {/* Return Policy Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200 mb-6">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">RETURN POLICY</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
                        Return Policy
                    </h1>
                </div>

                {/* Introduction */}
                <div className="mb-10 sm:mb-12">
                    <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                        We don't have any Return policy. But we offer the exchange within first 1 day from the date of delivery. If we deliver the wrong item by any fault, then we will exchange the printing product. If 1 day has passed since your delivery, you will not be offered exchange of any kind.
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-8 sm:space-y-10">
                    {/* Eligibility Requirements */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Eligibility for Exchange</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-4">
                                    In order to become eligible for an exchange, there are rules and regulations that you must have followed:
                                </p>
                                <ul className="space-y-3 text-base sm:text-lg text-gray-600 leading-relaxed list-none">
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#008ECC] mt-1 shrink-0">•</span>
                                        <span>The printing purchased item should be unused and in the same condition as you received it.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#008ECC] mt-1 shrink-0">•</span>
                                        <span>The item must have original packaging.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#008ECC] mt-1 shrink-0">•</span>
                                        <span>If the item that you purchased on a sale, then the item may not be eligible for a return / exchange.</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-[#008ECC] mt-1 shrink-0">•</span>
                                        <span>Further, only such items are replaced by us (based on an exchange request), if such items are found defective or damaged.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Exempted Products */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Exempted Products</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    You agree that there may be a certain category of products / items that are exempted from returns or refunds. Such categories of the products would be identified to you at the time of purchase.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Exchange Process */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Exchange Process</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        For exchange / return accepted request(s) (as applicable), once your returned product / item is received and inspected by us, we will send you an email to notify you about receipt of the returned / exchanged product.
                                    </p>
                                    <p>
                                        Further, if the same has been approved after the quality check at our end, your request (i.e. return / exchange) will be processed in accordance with our policies.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

