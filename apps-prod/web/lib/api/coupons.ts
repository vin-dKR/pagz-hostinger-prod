/**
 * Coupons API functions
 */

import { get, post, ApiResponse } from '../api-client';

export interface Coupon {
    id: string;
    code: string;
    name: string;
    description: string | null;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    minPurchaseAmount: number | null;
    maxDiscountAmount: number | null;
    validUntil: string;
}

export interface ValidateCouponResponse {
    coupon: {
        id: string;
        code: string;
        name: string;
        description: string | null;
        discountType: 'PERCENTAGE' | 'FIXED';
        discountValue: number;
    };
    discountAmount: number;
    finalAmount: number;
    eligibleItems?: Array<{
        productId: string;
        productName: string;
        quantity: number;
        eligibleAmount: number;
        discount: number;
    }>;
    ineligibleItems?: Array<{
        productId: string;
        productName: string;
        quantity: number;
        reason: string;
    }>;
    validation?: {
        isValid: boolean;
        isFullyValid: boolean;
        isPartiallyValid: boolean;
        errorMessage?: string;
    };
}

export interface ValidateCouponData {
    code: string;
    orderAmount: number;
    cartItems?: Array<{
        productId: string;
        quantity: number;
        price: number;
        categoryId?: string;
        productName?: string;
        categoryName?: string;
    }>;
}

/**
 * Get available coupons (public)
 */
export async function getAvailableCoupons(): Promise<ApiResponse<Coupon[]>> {
    return get<Coupon[]>('/coupons/available');
}

/**
 * Validate a coupon code
 */
export async function validateCoupon(data: ValidateCouponData): Promise<ApiResponse<ValidateCouponResponse>> {
    return post<ValidateCouponResponse>('/coupons/validate', data);
}

/**
 * Get user's coupon usage history
 */
export async function getMyCoupons(): Promise<ApiResponse<any[]>> {
    return get<any[]>('/coupons/my-coupons');
}

