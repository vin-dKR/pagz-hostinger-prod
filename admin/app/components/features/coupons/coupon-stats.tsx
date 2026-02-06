/**
 * Coupon Statistics Component
 * Displays key metrics about coupons
 * Optimized with TanStack Query
 */

'use client';

import { useCouponStats } from '@/lib/hooks/use-coupons';
import { StatCard } from '@/app/components/ui/stat-card';
import { LoadingState } from '@/app/components/ui/loading-state';
import { ErrorState } from '@/app/components/ui/error-state';
import { TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                title="Active Coupons"
                value={stats.totalActive}
                icon={TrendingUp}
                iconColor="text-blue-600"
                bgColor="bg-blue-50"
            />
            <StatCard
                title="Total Usage"
                value={stats.totalUsage.toLocaleString()}
                icon={Users}
                iconColor="text-green-600"
                bgColor="bg-green-50"
            />
            <StatCard
                title="Total Discount Given"
                value={`₹${stats.totalDiscount.toLocaleString()}`}
                icon={DollarSign}
                iconColor="text-purple-600"
                bgColor="bg-purple-50"
            />
            <StatCard
                title="Expiring Soon"
                value={stats.expiringSoon}
                icon={Calendar}
                iconColor="text-orange-600"
                bgColor="bg-orange-50"
            />
        </div>
    );
}

