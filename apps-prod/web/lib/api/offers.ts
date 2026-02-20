import { get } from "../api-client";
import type { ApiResponse } from "../api-client";

export interface Coupon {
    id: string;
    code: string;
    name: string;
    description: string | null;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minPurchaseAmount: number | null;
    maxDiscountAmount: number | null;
    validFrom: string;
    validUntil: string;
    applicableTo: "ALL" | "CATEGORY" | "PRODUCT" | "BRAND";
    usageLimit: number | null;
    usageLimitPerUser: number;
    createdAt: string;
    updatedAt: string;
    _count: {
        offerProducts: number;
    };
    totalUses: number;
}

export interface CouponProduct {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    basePrice: number;
    sellingPrice: number;
    mrp: number;
    stock: number;
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    rating: number | null;
    totalSold: number;
    createdAt: string;
    category: {
        id: string;
        name: string;
        slug: string;
    } | null;
    images: Array<{
        id: string;
        url: string;
        alt: string | null;
    }>;
    discountedPrice: number;
    savings: number;
}

/**
 * Get all active coupons
 */
export async function getCoupons(): Promise<ApiResponse<Coupon[]>> {
    return get<Coupon[]>("/coupons/available");
}

/**
 * Get a single coupon by ID
 */
export async function getCouponById(id: string): Promise<ApiResponse<Coupon>> {
    return get<Coupon>(`/coupons/${id}`);
}

/**
 * Get products for a specific coupon
 */
export async function getCouponProducts(id: string): Promise<ApiResponse<CouponProduct[]>> {
    return get<CouponProduct[]>(`/coupons/${id}/products`);
}
