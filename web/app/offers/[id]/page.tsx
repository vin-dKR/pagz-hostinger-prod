"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CouponProductCard from "@/app/components/offers/OfferProductCard";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { ArrowLeft, Calendar, Tag, Ticket, Copy, Check } from "lucide-react";
import { useCoupon, useCouponProducts } from "@/lib/hooks/use-coupons";

function OfferDetailPageChild() {
    const params = useParams();
    const router = useRouter();
    const offerId = params.id as string;

    const [copied, setCopied] = useState(false);

    // Use TanStack Query hooks - coupon will use cached data from list if available
    const { data: coupon, isLoading: couponLoading, error: couponError } = useCoupon(offerId);
    const { data: products = [], isLoading: productsLoading, error: productsError } = useCouponProducts(offerId);

    const loading = couponLoading || productsLoading;
    const error = couponError || productsError;

    const formatDiscount = () => {
        if (!coupon) return "";
        if (coupon.discountType === "PERCENTAGE") {
            return `${coupon.discountValue}% OFF`;
        }
        return `₹${coupon.discountValue} OFF`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const copyCodeToClipboard = () => {
        if (coupon) {
            navigator.clipboard.writeText(coupon.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getApplicableToText = () => {
        if (!coupon) return "";
        switch (coupon.applicableTo) {
            case "ALL":
                return "All Products";
            case "CATEGORY":
                return "Selected Categories";
            case "PRODUCT":
                return "Selected Products";
            case "BRAND":
                return "Selected Brands";
            default:
                return "All Products";
        }
    };

    if (loading) {
        return (
            <div className="h-200 bg-white flex items-center justify-center">
                <BarsSpinner size={18} />
            </div>
        );
    }

    if (error || !coupon) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Coupon Not Found</h2>
                    <p className="text-gray-600 mb-4">{error instanceof Error ? error.message : error || "The coupon you're looking for doesn't exist."}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => router.back()}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            Go Back
                        </button>
                        <Link
                            href="/offers"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
                        >
                            View All Coupons
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white py-4 sm:py-8 pb-0 lg:pb-40">
            <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 max-w-7xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-[#008ECC] mb-6 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Coupons</span>
                </button>

                {/* Coupon Header */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
                    <div className="relative h-64 md:h-80 w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <div className="text-white text-center p-6 w-full">
                            <Ticket className="w-20 h-20 mx-auto mb-4 opacity-80" />
                            <div className="bg-red-500 text-white px-6 py-3 rounded-full text-2xl font-bold inline-block mb-4 shadow-lg">
                                {formatDiscount()}
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4 mt-4 max-w-md mx-auto">
                                <p className="text-sm text-white/80 mb-2">Coupon Code</p>
                                <div className="flex items-center justify-center gap-3">
                                    <p className="text-3xl font-bold text-white font-mono tracking-wider">
                                        {coupon.code}
                                    </p>
                                    <button
                                        onClick={copyCodeToClipboard}
                                        className="p-2 bg-white/30 hover:bg-white/40 rounded-lg transition-colors"
                                        title="Copy code"
                                    >
                                        {copied ? (
                                            <Check className="w-5 h-5 text-white" />
                                        ) : (
                                            <Copy className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                </div>
                                {copied && (
                                    <p className="text-sm text-white mt-2">Code copied!</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{coupon.name}</h1>
                        {coupon.description && (
                            <p className="text-lg text-gray-600 mb-6">{coupon.description}</p>
                        )}

                        {/* Coupon Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Tag className="w-5 h-5 text-gray-400" />
                                <span>Applicable to: <strong className="text-gray-900">{getApplicableToText()}</strong></span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <span>Valid until: <strong className="text-gray-900">{formatDate(coupon.validUntil)}</strong></span>
                            </div>
                            {coupon.minPurchaseAmount && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span>Min. Purchase: <strong className="text-gray-900">₹{coupon.minPurchaseAmount}</strong></span>
                                </div>
                            )}
                            {coupon.usageLimit && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span>Uses Left: <strong className="text-gray-900">{Math.max(0, coupon.usageLimit - (coupon.totalUses || 0))}</strong></span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>Per User Limit: <strong className="text-gray-900">{coupon.usageLimitPerUser}</strong></span>
                            </div>
                        </div>

                        {/* Product Count */}
                        <div className="pt-4 border-t border-gray-200">
                            <p className="text-gray-600">
                                <strong>{products.length}</strong>{" "}
                                {products.length === 1 ? "product" : "products"} available with this coupon
                            </p>
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                {products.length > 0 ? (
                    <>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Products Available with This Coupon</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                            {products.map((product) => (
                                <CouponProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-xl shadow-md p-12 text-center">
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
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Available</h3>
                        <p className="text-gray-600 mb-6">
                            This coupon doesn&apos;t have any products available at the moment.
                        </p>
                        <Link
                            href="/offers"
                            className="inline-block px-6 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            View All Coupons
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function OfferDetailPage() {
    return (
        <Suspense fallback={
            <div className="h-200 bg-white flex items-center justify-center">
                <BarsSpinner size={18} />
            </div>
        }>
            <OfferDetailPageChild />
        </Suspense>
    );
}
