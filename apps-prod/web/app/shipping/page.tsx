export default function ShippingPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                {/* Header Section */}
                <div className="text-center mb-12 sm:mb-16">
                    {/* Shipping Policy Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200 mb-6">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">SHIPPING POLICY</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
                        Shipping Policy
                    </h1>
                </div>

                {/* Content Sections */}
                <div className="space-y-8 sm:space-y-10">
                    {/* Shipping Methods */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Shipping Methods</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    The orders for the user are shipped through registered domestic courier companies and/or speed post only.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Delivery Timeline */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Delivery Timeline</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        Orders will be delivered within 3 days from the date of the order and/or payment or as per the delivery date agreed at the time of order confirmation and delivering of the shipment, subject to courier company / post office norms.
                                    </p>
                                    <p>
                                        Platform Owner shall not be liable for any delay in delivery by the courier company / postal authority.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Delivery Address */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Delivery Address</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    Delivery of all orders will be made to the address provided by the buyer at the time of purchase. Delivery of our services will be confirmed on your email ID as specified at the time of registration.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Shipping Costs */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Shipping Costs</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    If there are any shipping cost(s) levied by the seller or the Platform Owner (as the case be), the same is not refundable.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

