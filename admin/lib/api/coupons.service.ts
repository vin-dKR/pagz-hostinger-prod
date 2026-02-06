/**
 * Coupons Service
 * Handles coupon management operations for admin
 */

import { get, post, put, del } from './api-client';

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type CouponApplicableTo = 'ALL' | 'CATEGORY' | 'PRODUCT';

export interface Coupon {
    id: string;
    code: string;
    name: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    usageLimitPerUser: number;
    validFrom: string;
    validUntil: string;
    isActive: boolean;
    applicableTo: CouponApplicableTo;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCouponData {
    code: string;
    name: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    usageLimitPerUser?: number;
    validFrom: string;
    validUntil: string;
    isActive?: boolean;
    applicableTo?: CouponApplicableTo;
    productIds?: string[];
    categoryIds?: string[];
}

export interface UpdateCouponData extends Partial<CreateCouponData> {
    id: string;
}

/**
 * Get all coupons
 */
export async function getCoupons(): Promise<Coupon[]> {
    const response = await get<Coupon[]>('/admin/coupons');

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch coupons');
    }

    return response.data;
}

/**
 * Get single coupon by ID
 */
export async function getCoupon(id: string): Promise<Coupon> {
    const response = await get<Coupon>(`/admin/coupons/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch coupon');
    }

    return response.data;
}

/**
 * Create new coupon
 */
export async function createCoupon(data: CreateCouponData): Promise<Coupon> {
    const response = await post<Coupon>('/admin/coupons', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create coupon');
    }

    return response.data;
}

/**
 * Update coupon
 */
export async function updateCoupon(data: UpdateCouponData): Promise<Coupon> {
    const { id, ...updateData } = data;
    const response = await put<Coupon>(`/admin/coupons/${id}`, updateData);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update coupon');
    }

    return response.data;
}

/**
 * Delete coupon
 */
export async function deleteCoupon(id: string): Promise<void> {
    const response = await del(`/admin/coupons/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete coupon');
    }
}

export interface CouponStats {
    totalActive: number;
    totalUsage: number;
    totalDiscount: number;
    expiringSoon: number;
}

export interface CouponAnalytics {
    totalUses: number;
    uniqueUsers: number;
    totalDiscount: number;
    averageDiscount: number;
    usageOverTime: Array<{
        date: string;
        count: number;
    }>;
}

export interface CouponUsage {
    id: string;
    couponId: string;
    userId: string;
    orderId: string | null;
    usedAt: string;
    discountAmount: number;
    user: {
        id: string;
        name: string | null;
        email: string;
    };
}

export interface PaginatedResponse<T> {
    usages: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Get coupon statistics
 */
export async function getCouponStats(): Promise<CouponStats> {
    const response = await get<CouponStats>('/admin/coupons/stats');

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch stats');
    }

    return response.data;
}

/**
 * Get coupon analytics
 */
export async function getCouponAnalytics(id: string): Promise<CouponAnalytics> {
    const response = await get<CouponAnalytics>(`/admin/coupons/${id}/analytics`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch analytics');
    }

    return response.data;
}

/**
 * Get coupon usage history
 */
export async function getCouponUsages(
    id: string,
    page: number = 1,
    limit: number = 20
): Promise<PaginatedResponse<CouponUsage>> {
    const response = await get<PaginatedResponse<CouponUsage>>(
        `/admin/coupons/${id}/usages?page=${page}&limit=${limit}`
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch usages');
    }

    return response.data;
}

/**
 * Bulk coupon operations
 */
export async function bulkCouponOperation(
    ids: string[],
    operation: 'activate' | 'deactivate' | 'delete'
): Promise<{ message: string; count: number }> {
    const response = await post<{ message: string; count: number }>('/admin/coupons/bulk', {
        ids,
        operation,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Bulk operation failed');
    }

    return response.data;
}

// Coupon Products & Categories Management

export interface CouponProduct {
    id: string;
    product: {
        id: string;
        name: string;
        slug: string | null;
        basePrice: number;
        sellingPrice: number | null;
        category: {
            id: string;
            name: string;
            slug: string;
        };
    };
}

export interface CouponCategory {
    id: string;
    name: string;
    slug: string;
    productCount: number;
}

/**
 * Get products for a coupon
 */
export async function getCouponProducts(id: string): Promise<CouponProduct[]> {
    const response = await get<CouponProduct[]>(`/admin/coupons/${id}/products`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch coupon products');
    }

    return response.data;
}

/**
 * Add products to a coupon
 */
export async function addCouponProducts(id: string, productIds: string[]): Promise<{ count: number }> {
    const response = await post<{ count: number }>(`/admin/coupons/${id}/products`, {
        productIds,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to add products to coupon');
    }

    return response.data;
}

/**
 * Remove products from a coupon
 */
export async function removeCouponProducts(id: string, productIds: string[]): Promise<{ count: number }> {
    // Using POST since DELETE with body may not be supported in all environments
    const response = await post<{ count: number }>(`/admin/coupons/${id}/products/remove`, {
        productIds,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to remove products from coupon');
    }

    return response.data;
}

/**
 * Get categories for a coupon
 */
export async function getCouponCategories(id: string): Promise<CouponCategory[]> {
    const response = await get<CouponCategory[]>(`/admin/coupons/${id}/categories`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch coupon categories');
    }

    return response.data;
}

/**
 * Add categories to a coupon (adds all products in those categories)
 */
export async function addCouponCategories(id: string, categoryIds: string[]): Promise<{ count: number }> {
    const response = await post<{ count: number }>(`/admin/coupons/${id}/categories`, {
        categoryIds,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to add categories to coupon');
    }

    return response.data;
}

/**
 * Remove categories from a coupon (removes all products in those categories)
 */
export async function removeCouponCategories(id: string, categoryIds: string[]): Promise<{ count: number }> {
    // Using POST since DELETE with body may not be supported in all environments
    const response = await post<{ count: number }>(`/admin/coupons/${id}/categories/remove`, {
        categoryIds,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to remove categories from coupon');
    }

    return response.data;
}
