/**
 * Coupon Detail Page
 * Shows coupon details, analytics, and usage history
 */

import { CouponDetailClient } from '@/app/components/features/coupons/coupon-detail-client';
import { getCoupon, getCouponAnalytics, getCouponUsages } from '@/lib/server/coupons-data';

export default async function CouponDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [coupon, analytics, usagesData] = await Promise.all([
        getCoupon(id),
        getCouponAnalytics(id),
        getCouponUsages(id, 1, 20),
    ]);

    return (
        <CouponDetailClient
            couponId={id}
            initialCoupon={coupon || undefined}
            initialAnalytics={analytics || undefined}
            initialUsages={usagesData?.data || []}
            initialUsagePagination={usagesData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }}
        />
    );
}
