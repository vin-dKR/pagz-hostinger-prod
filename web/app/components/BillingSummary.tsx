"use client";

import { useState } from "react";
import Link from "next/link";

interface BillingSummaryProps {
    mrp: number;
    subtotal: number; // Base price subtotal
    addonsSubtotal?: number; // Addon price subtotal
    discount: number;
    couponApplied: number;
    shipping: number;
    tax: number;
    grandTotal: number;
    itemCount: number;
    showCheckoutActions?: boolean;
    onPay?: () => Promise<void> | void;
    isPaying?: boolean;
}

export default function BillingSummary({
    mrp,
    subtotal,
    addonsSubtotal = 0,
    discount,
    couponApplied,
    shipping,
    tax,
    grandTotal,
    showCheckoutActions = true,
    onPay,
    isPaying = false,
}: BillingSummaryProps) {
    const [orderComment, setOrderComment] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-xl font-hkgb font-bold text-gray-900 mb-6">Billing Summary</h2>

            {/* Price Breakdown */}
            <div className="space-y-3 mb-6">
                {mrp > 0 && (
                    <div className="flex justify-between text-gray-500">
                        <span>MRP</span>
                        <span className="font-medium line-through">₹{mrp.toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between text-gray-600">
                    <span>Base Price Total</span>
                    <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                    <span>Addon Price Total</span>
                    <span className="font-medium">
                        ₹{addonsSubtotal.toFixed(2)}
                    </span>
                </div>

                <div className="flex justify-between text-gray-600">
                    <span>Discount</span>
                    <span className={`font-medium ${discount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {discount > 0 ? '-' : ''}₹{discount.toFixed(2)}
                    </span>
                </div>

                <div className="flex justify-between text-gray-600">
                    <span>Coupon Applied</span>
                    <span className={`font-medium ${couponApplied > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {couponApplied > 0 ? '-' : ''}₹{couponApplied.toFixed(2)}
                    </span>
                </div>

                <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="font-hkgb font-medium">₹{shipping.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span className="font-hkgb font-medium">₹{tax.toFixed(2)}</span>
                </div>

                <hr className="border-gray-200 my-4" />

                <div className="flex justify-between text-2xl font-hkgb font-bold text-gray-900">
                    <span>Grand Total</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                </div>
            </div>

            {/* Checkout-specific actions - only show if showCheckoutActions is true */}
            {showCheckoutActions && (
                <>
                    {/* Order Comment */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Order Comment</label>
                        <textarea
                            value={orderComment}
                            onChange={(e) => setOrderComment(e.target.value)}
                            placeholder="Type here..."
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                    </div>

                    {/* Privacy Policy Checkbox */}
                    <div className="mb-6">
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="w-4 h-4 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                                Please check to acknowledge our{" "}
                                <Link href="/privacy" className="text-blue-600 hover:underline">
                                    Privacy & Terms Policy
                                </Link>
                            </span>
                        </label>
                    </div>

                    {/* Pay Button */}
                    <button
                        disabled={!agreedToTerms || isPaying || !onPay}
                        onClick={() => {
                            if (!onPay || !agreedToTerms) return;
                            void onPay();
                        }}
                        className={`w-full font-hkgb font-bold px-6 py-4 rounded-lg text-white transition-colors ${agreedToTerms
                            ? "bg-[#008ECC] hover:bg-[#007CB2]"
                            : "bg-gray-400 cursor-not-allowed"
                            }`}
                    >
                        {isPaying ? "Processing..." : `Pay ₹${grandTotal.toFixed(2)}`}
                    </button>

                    {/* Security Badge */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-yellow-500"
                        >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Norton Security Checkout</span>
                    </div>
                </>
            )}

        </div>
    );
}
