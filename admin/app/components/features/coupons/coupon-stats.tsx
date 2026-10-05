/**
 * Coupon Statistics Component
 * Displays key metrics about coupons
 * Optimized with TanStack Query
 */

'use client';

import { useCouponStats } from '@/lib/hooks/use-coupons';
import { LoadingState } from '@/app/components/ui/loading-state';
import { ErrorState } from '@/app/components/ui/error-state';
import { MetricStrip, MetricTile } from '@/app/components/features/management/metric-tile';

export function CouponStats() {
    const { data: stats, isLoading, error, refetch } = useCouponStats();

    if (isLoading) {
        return <LoadingState message="Loading statistics..." size="sm" />;
    }

    if (error) {
        return (
            <ErrorState
                message={error instanceof Error ? error.message : 'Failed to load statistics'}
                onRetry={() => refetch()}
            />
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <MetricStrip>
            <MetricTile label="Active coupons" value={stats.totalActive.toLocaleString()} detail="Available to customers" />
            <MetricTile label="Total usage" value={stats.totalUsage.toLocaleString()} detail="Times redeemed" />
            <MetricTile label="Total discount given" value={`₹${stats.totalDiscount.toLocaleString()}`} detail="Across all redemptions" />
            <MetricTile label="Expiring soon" value={stats.expiringSoon.toLocaleString()} detail="Coupons nearing expiry" emphasis={stats.expiringSoon > 0 ? 'warning' : 'default'} />
        </MetricStrip>
    );
}
