export default function ServiceCategoryLoading() {
    return (
        <div className="min-h-screen bg-white py-8 pb-24">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumbs skeleton - Hidden on mobile, shown on tablet and above */}
                <div className="hidden sm:block mb-6">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                        <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse" />
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                        <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse" />
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    </div>
                </div>

                {/* Mobile Breadcrumb skeleton */}
                <div className="sm:hidden mb-4">
                    <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                </div>

                {/* Main Product Section - Matching ProductPageTemplate layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-12">
                    {/* Left Column - Product Images (6/12 on desktop) */}
                    <div className="lg:col-span-6 space-y-4 sm:space-y-5">
                        {/* Product Gallery skeleton */}
                        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100">
                            <div className="relative aspect-square rounded-xl bg-gray-200 animate-pulse" />
                        </div>
                    </div>

                    {/* Right Column - Product Info, Pricing, Upload & Customization (6/12 on desktop) */}
                    <div className="lg:col-span-6">
                        <div className="sticky top-24 space-y-4 sm:space-y-6">
                            {/* Product Title & Description skeleton */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                <div className="h-8 sm:h-9 w-3/4 bg-gray-200 rounded animate-pulse mb-3" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                                    <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
                                </div>
                            </div>

                            {/* Features skeleton */}
                            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100">
                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                                    ))}
                                </div>
                            </div>

                            {/* File Upload Section skeleton */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center">
                                    <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse mb-3" />
                                    <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-2" />
                                    <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                                </div>
                            </div>

                            {/* Configuration Options skeleton */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
                                <div className="space-y-4">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                                            <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Price Section skeleton */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                <div className="space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                                        </div>
                                    ))}
                                    <div className="pt-3 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                                            <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                                {/* Tax Info skeleton */}
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                                </div>
                            </div>

                            {/* Action Buttons skeleton */}
                            <div className="flex gap-3">
                                <div className="h-12 flex-1 bg-gray-200 rounded-lg animate-pulse" />
                                <div className="h-12 flex-1 bg-gray-200 rounded-lg animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

