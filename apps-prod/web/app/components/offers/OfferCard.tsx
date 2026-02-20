"use client";

import Link from "next/link";
import { Calendar, Tag, Ticket } from "lucide-react";
import type { Coupon } from "@/lib/api/offers";
import { usePrefetchCoupon } from "@/lib/hooks/use-coupons";

interface CouponCardProps {
    coupon: Coupon;
}

export default function CouponCard({ coupon }: CouponCardProps) {
    const prefetchCoupon = usePrefetchCoupon();

    const handleMouseEnter = () => {
        // Prefetch coupon data on hover for instant navigation
        prefetchCoupon(coupon.id);
    };

    const formatDiscount = () => {
        if (coupon.discountType === "PERCENTAGE") {
            return `${coupon.discountValue}% OFF`;
        }
        return `₹${coupon.discountValue} OFF`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const getApplicableToText = () => {
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

    return (
        <Link href={`/offers/${coupon.id}`} onMouseEnter={handleMouseEnter}>
            <div className="group relative bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer">
                {/* Coupon Header with Code */}
                <div className="relative h-48 w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <div className="text-white text-center p-4 w-full">
                        <Ticket className="w-12 h-12 mx-auto mb-2 opacity-80" />
                        <div className="bg-red-500 text-white px-4 py-2 rounded-full text-lg font-bold inline-block mb-3 shadow-lg">
                            {formatDiscount()}
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 mt-3">
                            <p className="text-xs text-white/80 mb-1">Coupon Code</p>
                            <p className="text-2xl font-bold text-white font-mono tracking-wider">
                                {coupon.code}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {coupon.name}
                    </h3>
                    {coupon.description && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                            {coupon.description}
                        </p>
                    )}

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <span>Applicable to: <strong>{getApplicableToText()}</strong></span>
                        </div>
                        {coupon.minPurchaseAmount && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>Min. Purchase: <strong>₹{coupon.minPurchaseAmount}</strong></span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>Valid until {formatDate(coupon.validUntil)}</span>
                        </div>
                    </div>

                    {/* Product Count & Usage Limits */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-gray-600">
                                {coupon._count.offerProducts} {coupon._count.offerProducts === 1 ? "product" : "products"}
                            </span>
                            {coupon.usageLimit && (
                                <span className="text-xs text-gray-500">
                                    {Math.max(0, coupon.usageLimit - (coupon.totalUses || 0))} uses left
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                            View Details →
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
