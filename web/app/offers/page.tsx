"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CouponCard from "../components/offers/OfferCard";
import { BarsSpinner } from "../components/shared/BarsSpinner";
import { useCoupons } from "@/lib/hooks/use-coupons";

type FilterType = "all" | "products" | "categories"; 

function OffersPageChild() {
    const searchParams = useSearchParams();

    // Get filter from URL params or default to "all"
    const filterParam = searchParams.get("filter") || "all";
    const activeFilter = (filterParam as FilterType) || "all";

    // Use TanStack Query for optimized data fetching
    const { data: coupons = [], isLoading: loading, error } = useCoupons();

    // Memoized filtered coupons - no need for separate state
    const filteredCoupons = useMemo(() => {
        if (activeFilter === "products") {
            return coupons.filter(
                (coupon) => coupon.applicableTo === "PRODUCT" && coupon._count.offerProducts > 0
            );
        } else if (activeFilter === "categories") {
            return coupons.filter(
                (coupon) => coupon.applicableTo === "CATEGORY" && coupon._count.offerProducts > 0
            );
        }
        return coupons;
    }, [coupons, activeFilter]);

    const handleFilterChange = (filter: FilterType) => {
        // Update URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.set("filter", filter);
        window.history.pushState({}, "", url);
    };

    if (loading) {
        return (
            <div className="h-200 bg-white py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center py-20">
                        <BarsSpinner size={18} />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-200 bg-white py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center py-12">
                        <div className="text-red-600 text-lg mb-4">⚠️ Error Loading Coupons</div>
                        <p className="text-gray-600 mb-4">{error instanceof Error ? error.message : "An error occurred"}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white py-4 sm:py-8 pb-0 lg:pb-40">
            <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Coupons & Discounts</h1>
                    <p className="text-sm md:text-base text-gray-600">Discover amazing coupon codes and discounts on our products</p>
                </div>

                {/* Filter Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="flex space-x-6 md:space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                        <button
                            onClick={() => handleFilterChange("all")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeFilter === "all"
                                ? "border-[#008ECC] text-[#008ECC]"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            All Coupons
                            {activeFilter === "all" && (
                                <span className="ml-2 text-xs text-gray-500">
                                    ({coupons.length})
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => handleFilterChange("products")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeFilter === "products"
                                ? "border-[#008ECC] text-[#008ECC]"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            Product Coupons
                            {activeFilter === "products" && (
                                <span className="ml-2 text-xs text-gray-500">
                                    ({coupons.filter((c) => c.applicableTo === "PRODUCT" && c._count.offerProducts > 0).length})
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => handleFilterChange("categories")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeFilter === "categories"
                                ? "border-[#008ECC] text-[#008ECC]"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            Category Coupons
                            {activeFilter === "categories" && (
                                <span className="ml-2 text-xs text-gray-500">
                                    ({coupons.filter((c) => c.applicableTo === "CATEGORY" && c._count.offerProducts > 0).length})
                                </span>
                            )}
                        </button>
                    </nav>
                </div>

                {/* Coupons Grid */}
                {filteredCoupons.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {filteredCoupons.map((coupon) => (
                            <CouponCard key={coupon.id} coupon={coupon} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="inline-block bg-gray-100 rounded-full p-4 mb-4">
                            <svg
                                className="w-12 h-12 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Coupons Available</h3>
                        <p className="text-gray-600 mb-6">
                            {activeFilter === "all"
                                ? "There are no active coupons at the moment. Check back soon for exciting deals!"
                                : `No coupons match the "${activeFilter}" filter.`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function OffersPage() {
    return (
        <Suspense fallback={
            <div className="h-200 bg-white flex items-center justify-center">
                <BarsSpinner size={18} />
            </div>
        }>
            <OffersPageChild />
        </Suspense>
    );
}
