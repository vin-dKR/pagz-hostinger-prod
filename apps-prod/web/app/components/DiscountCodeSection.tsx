"use client";

import { useState, useEffect } from "react";
import { X, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { getAvailableCoupons, type Coupon } from "@/lib/api/coupons";

interface DiscountCodeSectionProps {
    couponCode: string;
    setCouponCode: (code: string) => void;
    onApply: () => Promise<boolean>;
    isApplying: boolean;
    error: string | null;
    appliedCoupon: {
        coupon: {
            code: string;
            name: string;
        };
        discountAmount: number;
        validation?: {
            isValid: boolean;
            isFullyValid: boolean;
            isPartiallyValid: boolean;
            errorMessage?: string;
        };
        ineligibleItems?: Array<{
            productId: string;
            productName: string;
            quantity: number;
            reason: string;
        }>;
    } | null;
    onRemove: () => void;
    subtotal?: number;
}

function formatDiscount(type: 'PERCENTAGE' | 'FIXED', value: number): string {
    if (type === 'PERCENTAGE') {
        return `${value}% OFF`;
    }
    return `₹${value} OFF`;
}

export default function DiscountCodeSection({
    couponCode,
    setCouponCode,
    onApply,
    isApplying,
    error,
    appliedCoupon,
    onRemove,
    subtotal = 0,
}: DiscountCodeSectionProps) {
    const [localCode, setLocalCode] = useState(couponCode);
    const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingCoupons, setLoadingCoupons] = useState(false);

    useEffect(() => {
        loadCoupons();
    }, []);

    const loadCoupons = async () => {
        try {
            setLoadingCoupons(true);
            const response = await getAvailableCoupons();
            if (response.success && response.data) {
                // Filter eligible coupons based on subtotal
                const eligible = response.data.filter((c) => {
                    if (c.minPurchaseAmount) {
                        return subtotal >= Number(c.minPurchaseAmount);
                    }
                    return true;
                });
                setAvailableCoupons(eligible);
            }
        } catch (err) {
            console.error('Failed to load coupons:', err);
        } finally {
            setLoadingCoupons(false);
        }
    };

    const handleSuggestionClick = async (code: string) => {
        setCouponCode(code);
        setLocalCode(code);
        setShowSuggestions(false);
        const success = await onApply();
        if (success) {
            setLocalCode("");
        }
    };

    const handleApply = async () => {
        const success = await onApply();
        if (success) {
            setLocalCode("");
        }
    };

    return (
        <div className="space-y-3">
            {appliedCoupon ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Check size={18} className="text-green-600" />
                            <div>
                                <p className="text-sm font-medium text-green-900">
                                    {appliedCoupon.coupon.code} - {appliedCoupon.coupon.name}
                                </p>
                                <p className="text-xs text-green-700">
                                    Discount: ₹{appliedCoupon.discountAmount.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onRemove}
                            className="p-1 text-green-600 hover:text-green-700 transition-colors cursor-pointer"
                            aria-label="Remove coupon"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Show partial validity warning */}
                    {appliedCoupon.validation?.isPartiallyValid && appliedCoupon.ineligibleItems && appliedCoupon.ineligibleItems.length > 0 && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800 font-medium mb-2">
                                ⚠️ Coupon applied to eligible items
                            </p>
                            <div>
                                <p className="text-xs text-yellow-700 font-medium mb-1">
                                    Not valid for:
                                </p>
                                <ul className="text-xs text-yellow-600 list-disc list-inside space-y-1">
                                    {appliedCoupon.ineligibleItems.map((item) => (
                                        <li key={item.productId}>
                                            {item.productName} ({item.reason})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex gap-2 relative">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={localCode}
                                onChange={(e) => {
                                    setLocalCode(e.target.value);
                                    setCouponCode(e.target.value);
                                }}
                                placeholder="Enter discount code"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={isApplying}
                                onFocus={() => {
                                    if (availableCoupons.length > 0) {
                                        setShowSuggestions(true);
                                    }
                                }}
                            />
                            {availableCoupons.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowSuggestions(!showSuggestions)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showSuggestions ? (
                                        <ChevronUp size={20} />
                                    ) : (
                                        <ChevronDown size={20} />
                                    )}
                                </button>
                            )}

                            {showSuggestions && availableCoupons.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {availableCoupons.map((coupon) => (
                                        <button
                                            key={coupon.id}
                                            type="button"
                                            onClick={() => handleSuggestionClick(coupon.code)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                                        >
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-900">{coupon.code}</div>
                                                <div className="text-sm text-gray-500">{coupon.name}</div>
                                                {coupon.minPurchaseAmount && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        Min. purchase: ₹{Number(coupon.minPurchaseAmount).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-blue-600 font-bold ml-4">
                                                {formatDiscount(coupon.discountType, coupon.discountValue)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleApply}
                            disabled={isApplying || !localCode.trim()}
                            className="px-6 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isApplying ? "Applying..." : "Apply"}
                        </button>
                    </div>
                    {availableCoupons.length > 0 && (
                        <p className="text-xs text-gray-500">
                            {availableCoupons.length} coupon{availableCoupons.length !== 1 ? 's' : ''} available
                        </p>
                    )}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

