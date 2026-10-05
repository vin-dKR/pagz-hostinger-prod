import 'server-only';

import type { Coupon, CouponAnalytics, CouponUsage } from '../api/coupons.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single coupon by ID.
 */
export async function getCoupon(id: string): Promise<Coupon | null> {
    try {
    try {
        const res = await fetch(`${baseUrl}/admin/coupons/${id}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
                console.error(`[Coupons] API returned ${res.status} for coupon ${id}`);
                return null;
            }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[Coupons] Error parsing JSON response:', jsonError);
            return null;
        }

        return body.data || body;
        } catch (fetchError) {
            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[Coupons] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[Coupons] Unexpected error fetching coupon:', error);
        return null;
    }
}

/**
 * Server-side helper to fetch coupon analytics.
 */
export async function getCouponAnalytics(id: string): Promise<CouponAnalytics | null> {
    try {
    try {
        const res = await fetch(`${baseUrl}/admin/coupons/${id}/analytics`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
                console.error(`[Coupons] API returned ${res.status} for coupon analytics ${id}`);
                return null;
            }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[Coupons] Error parsing JSON response:', jsonError);
            return null;
        }

        return body.data || body;
        } catch (fetchError) {
            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[Coupons] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[Coupons] Unexpected error fetching analytics:', error);
        return null;
    }
}

/**
 * Server-side helper to fetch coupon usages.
 */
export async function getCouponUsages(
    id: string,
    page: number = 1,
    limit: number = 20
): Promise<{ data: CouponUsage[]; pagination: any } | null> {
    try {
    try {
        const res = await fetch(`${baseUrl}/admin/coupons/${id}/usages?page=${page}&limit=${limit}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
                console.error(`[Coupons] API returned ${res.status} for coupon usages ${id}`);
                return null;
            }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[Coupons] Error parsing JSON response:', jsonError);
            return null;
        }

        return body.data || body;
        } catch (fetchError) {
            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[Coupons] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[Coupons] Unexpected error fetching usages:', error);
        return null;
    }
}
