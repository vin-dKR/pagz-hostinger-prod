/**
 * Reusable Coupon Discount Display Component
 * Displays discount value with proper formatting
 */

import { Badge } from './badge';
import { Percent, IndianRupee } from 'lucide-react';

interface CouponDiscountDisplayProps {
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    maxDiscountAmount?: number | null;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

export function CouponDiscountDisplay({
    discountType,
    discountValue,
    maxDiscountAmount,
    size = 'md',
    showIcon = false,
}: CouponDiscountDisplayProps) {
    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg font-bold',
    };

    const displayValue =
        discountType === 'PERCENTAGE' ? `${discountValue}%` : `₹${discountValue}`;

    return (
        <div className="flex items-center gap-2">
            <span className={`${sizeClasses[size]} font-semibold text-blue-600`}>
                {displayValue}
            </span>
            {maxDiscountAmount && discountType === 'PERCENTAGE' && (
                <span className="text-xs text-gray-500">
                    (max ₹{maxDiscountAmount})
                </span>
            )}
            {showIcon && (
                <span className="text-gray-400">
                    {discountType === 'PERCENTAGE' ? (
                        <Percent className="h-4 w-4" />
                    ) : (
                        <IndianRupee className="h-4 w-4" />
                    )}
                </span>
            )}
        </div>
    );
}
