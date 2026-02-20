export default function RefundPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                {/* Header Section */}
                <div className="text-center mb-12 sm:mb-16">
                    {/* Refund Policy Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full border border-gray-200 mb-6">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium text-gray-700">REFUND & CANCELLATION POLICY</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
                        Refund & Cancellation Policy
                    </h1>
                </div>

                {/* Introduction */}
                <div className="mb-10 sm:mb-12">
                    <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                        This refund and cancellation policy outlines how you can cancel or seek a refund for a product / service that you have purchased through the Platform. Under this policy:
                    </p>
                </div>

                {/* Content Sections */}
                <div className="space-y-8 sm:space-y-10">
                    {/* Cancellation Policy */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Cancellation Policy</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        Cancellations will only be considered if the request is made after 1 hour of placing the order. However, cancellation requests may not be entertained if the orders have been communicated to such sellers / merchant(s) listed on the Platform and they have initiated the process of shipping them, or the product is out for delivery.
                                    </p>
                                    <p>
                                        In such an event, you may choose to reject the product at the doorstep.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Damaged or Defective Items */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Damaged or Defective Items</h2>
                                <div className="space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                                    <p>
                                        In case of receipt of damaged or defective items, please report to our customer service team. The request would be entertained once the seller/ merchant listed on the Platform, has checked and determined the same at its own end. This should be reported within 1 days of receipt of products.
                                    </p>
                                    <p>
                                        In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within 1 days of receiving the product. The customer service team after looking into your complaint will take an appropriate decision.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Warranty Products */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Warranty Products</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    In case of complaints regarding the products that come with a warranty from the manufacturers, please refer the issue to them.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Refund Processing */}
                    <section>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 bg-[#008ECC]/10 rounded-xl flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-[#008ECC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Refund Processing</h2>
                                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                                    In case of any exchange approved by PAGZ, it will take 3-4 working days for the refund to be credited to original mode of payment.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

