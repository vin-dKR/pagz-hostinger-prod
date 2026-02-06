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
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Coupon</h1>
                <p className="mt-2 text-sm text-gray-600">
                    Update coupon details and settings
                </p>
            </div>

            <CouponForm initialData={coupon} onSuccess={handleSuccess} />
        </div>
    );
}

