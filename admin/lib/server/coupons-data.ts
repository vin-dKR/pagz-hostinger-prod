import 'server-only';

import { cookies } from 'next/headers';
import type { Coupon, CouponAnalytics, CouponUsage } from '../api/coupons.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single coupon by ID.
 */
export async function getCoupon(id: string): Promise<Coupon | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/coupons/${id}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return null;
        }

        const body = await res.json();
        return body.data || body;
    } catch (error) {
        console.error('[Coupons] Error fetching coupon:', error);
        return null;
    }
}

/**
 * Server-side helper to fetch coupon analytics.
 */
export async function getCouponAnalytics(id: string): Promise<CouponAnalytics | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/coupons/${id}/analytics`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return null;
        }

        const body = await res.json();
        return body.data || body;
    } catch (error) {
        console.error('[Coupons] Error fetching analytics:', error);
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
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/coupons/${id}/usages?page=${page}&limit=${limit}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return null;
        }

        const body = await res.json();
        return body.data || body;
    } catch (error) {
        console.error('[Coupons] Error fetching usages:', error);
        return null;
    }
}

