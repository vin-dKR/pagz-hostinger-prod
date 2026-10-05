/**
 * Create Coupon Page
 */

'use client';

import { useRouter } from 'next/navigation';
import { CouponForm } from '@/app/components/features/coupons/coupon-form';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function CreateCouponPage() {
    const router = useRouter();

    const handleSuccess = () => {
        router.push('/coupons');
    };

    return (
        <ManagementPage section="Commerce / Promotions" title="Create coupon" description="Create a new discount coupon for your customers.">
            <CouponForm onSuccess={handleSuccess} />
        </ManagementPage>
    );
}
