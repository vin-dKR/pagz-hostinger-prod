/**
 * Edit Coupon Page
 * Optimized with TanStack Query
 */

'use client';

import { useRouter, useParams } from 'next/navigation';
import { CouponForm } from '@/app/components/features/coupons/coupon-form';
import { useCoupon } from '@/lib/hooks/use-coupons';
import { LoadingState } from '@/app/components/ui/loading-state';
import { ErrorState } from '@/app/components/ui/error-state';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function EditCouponPage() {
    const router = useRouter();
    const params = useParams();
    const couponId = params.id as string;
    const { data: coupon, isLoading, error, refetch } = useCoupon(couponId);

    const handleSuccess = () => {
        router.push('/coupons');
    };

    if (isLoading) {
        return <LoadingState message="Loading coupon..." />;
    }

    if (error) {
        return (
            <ErrorState
                message={error instanceof Error ? error.message : 'Failed to load coupon'}
                onRetry={() => refetch()}
            />
        );
    }

    if (!coupon) {
        return <ErrorState message="Coupon not found" />;
    }

    return (
        <ManagementPage section="Commerce / Promotions" title="Edit coupon" description="Update coupon details and settings.">
            <CouponForm initialData={coupon} onSuccess={handleSuccess} />
        </ManagementPage>
    );
}
