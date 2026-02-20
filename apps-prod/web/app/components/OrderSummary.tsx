"use client";

import { useState } from "react";
import Link from "next/link";

interface OrderSummaryProps {
    discount?: number;
    discountPercentage?: number;
    total: number;
}

export default function OrderSummary({
    discount = 0,
    discountPercentage,
    total,
}: OrderSummaryProps) {
    const [promoCode, setPromoCode] = useState("");

    const handleApplyPromo = () => {
        // Handle promo code application
        console.log("Apply promo code:", promoCode);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

            {/* Price Breakdown */}
            <div className="space-y-3 mb-6">

                {discount > 0 && (
                    <div className="flex justify-between text-red-600">
                        <span>Discount {discountPercentage && `(-${discountPercentage}%)`}</span>
                        <span className="font-hkgb font-medium">-₹{discount.toFixed(2)}</span>
                    </div>
                )}

                <hr className="border-gray-200 my-4" />

                <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span className="font-hkgb">₹{total.toFixed(2)}</span>
                </div>
            </div>

            {/* Promo Code */}
            <div className="mb-6">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Add promo code"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            className="w-full bg-[#F0F0F0] px-4 py-2 pl-10 border border-gray-300 rounded-full outline-none focus:ring-2 focus:ring-blue-500 focus:[]"
                        />
                    </div>
                    <button
                        onClick={handleApplyPromo}
                        className="px-6 py-2 bg-[#1EADD8] text-white rounded-full hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                    >
                        Apply
                    </button>
                </div>
            </div>

            {/* Checkout Button */}
            <Link
                href="/checkout"
                className="block w-full px-6 py-3 bg-[#1EADD8] text-white rounded-full hover:bg-blue-700 transition-colors font-medium text-center"
            >
                Go to Checkout
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="inline-block ml-2"
                >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            </Link>
        </div>
    );
}
