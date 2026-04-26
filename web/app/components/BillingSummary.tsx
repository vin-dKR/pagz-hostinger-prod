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
    grandTotal: number;
    itemCount: number;
    showCheckoutActions?: boolean;
    onPay?: () => Promise<void> | void;
    isPaying?: boolean;
    hideCouponAndShipping?: boolean; // Hide coupon and shipping (for cart page)
    disabled?: boolean; // Externally disable the Pay button
    disabledMessage?: string; // Helper text shown when externally disabled
    /** Lifted-state hook for the Order Comment textarea — checkout
     *  needs the value at submit time so the api can persist it on the
     *  Order row. When omitted the component falls back to local state
     *  for non-checkout surfaces (cart preview etc). */
    orderComment?: string;
    onOrderCommentChange?: (value: string) => void;
}

export default function BillingSummary({
    mrp,
    subtotal,
    addonsSubtotal = 0,
    discount,
    couponApplied,
    shipping,
    grandTotal,
    showCheckoutActions = true,
    onPay,
    isPaying = false,
    hideCouponAndShipping = false,
    disabled = false,
    disabledMessage,
    orderComment: orderCommentProp,
    onOrderCommentChange,
}: BillingSummaryProps) {
    // When the parent doesn't lift state, fall back to a local buffer so
    // the textarea remains usable on cart / preview surfaces that don't
    // need to read it back.
    const [localOrderComment, setLocalOrderComment] = useState("");
    const orderComment = orderCommentProp ?? localOrderComment;
    const setOrderComment = (value: string) => {
        if (onOrderCommentChange) onOrderCommentChange(value);
        else setLocalOrderComment(value);
    };
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    return (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-hkgb font-bold text-gray-900 mb-4 sm:mb-6">Billing Summary</h2>

            {/* Price Breakdown */}
            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                {mrp > 0 && (
                    <div className="flex justify-between text-sm sm:text-base text-gray-500">
                        <span>MRP</span>
                        <span className="font-medium line-through">₹{mrp.toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between text-sm sm:text-base text-gray-600">
                    <span>Base Price Total</span>
                    <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base text-gray-600">
                    <span>Addon Price Total</span>
                    <span className="font-medium">
                        ₹{addonsSubtotal.toFixed(2)}
                    </span>
                </div>

                {/* <div className="flex justify-between text-sm sm:text-base text-gray-600">
                    <span>Discount</span>
                    <span className={`font-medium ${discount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {discount > 0 ? '-' : ''}₹{discount.toFixed(2)}
                    </span>
                </div> */}

                {!hideCouponAndShipping && (
                    <>
                        <div className="flex justify-between text-sm sm:text-base text-gray-600">
                            <span>Coupon Applied</span>
                            <span className={`font-medium ${couponApplied > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                {couponApplied > 0 ? '-' : ''}₹{couponApplied.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex justify-between text-sm sm:text-base text-gray-600">
                            <span>Shipping</span>
                            <span className="font-hkgb font-medium">₹{shipping.toFixed(2)}</span>
                        </div>
                    </>
                )}

                <hr className="border-gray-200 my-3 sm:my-4" />

                <div className="flex justify-between text-xl sm:text-2xl font-hkgb font-bold text-gray-900">
                    <span>Grand Total</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                </div>
            </div>

            {/* Checkout-specific actions - only show if showCheckoutActions is true */}
            {showCheckoutActions && (
                <>
                    {/* Order Comment */}
                    <div className="mb-4 sm:mb-6">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Order Comment</label>
                        <textarea
                            value={orderComment}
                            onChange={(e) => setOrderComment(e.target.value)}
                            placeholder="Special instructions, delivery notes, etc."
                            rows={4}
                            maxLength={2000}
                            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                    </div>

                    {/* Privacy Policy Checkbox */}
                    <div className="mb-4 sm:mb-6">
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="w-4 h-4 mt-0.5 sm:mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
                            />
                            <span className="text-xs sm:text-sm text-gray-700">
                                Please check to acknowledge our{" "}
                                <Link href="/privacy" className="text-blue-600 hover:underline">
                                    Privacy & Terms Policy
                                </Link>
                            </span>
                        </label>
                    </div>

                    {/* Pay Button */}
                    <button
                        disabled={!agreedToTerms || isPaying || !onPay || disabled}
                        onClick={() => {
                            if (!onPay || !agreedToTerms || disabled) return;
                            void onPay();
                        }}
                        className={`w-full font-hkgb font-bold px-4 sm:px-6 py-3 sm:py-4 rounded-lg text-sm sm:text-base text-white transition-colors ${agreedToTerms && !disabled
                            ? "bg-[#008ECC] hover:bg-[#007CB2]"
                            : "bg-gray-400 cursor-not-allowed"
                            }`}
                    >
                        {isPaying ? "Processing..." : grandTotal <= 0 ? "Place Order" : `Pay ₹${grandTotal.toFixed(2)}`}
                    </button>

                    {disabled && disabledMessage && (
                        <p className="mt-2 text-center text-xs sm:text-sm text-red-600">
                            {disabledMessage}
                        </p>
                    )}

                    {/* Security Badge */}
                    <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-600">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-yellow-500 sm:w-5 sm:h-5"
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
