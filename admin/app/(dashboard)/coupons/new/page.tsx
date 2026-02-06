/**
 * Create Coupon Page
 */

'use client';

import { useRouter } from 'next/navigation';
import { CouponForm } from '@/app/components/features/coupons/coupon-form';

export default function CreateCouponPage() {
    const router = useRouter();

    const handleSuccess = () => {
        router.push('/coupons');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Coupon</h1>
                <p className="mt-2 text-sm text-gray-600">
                    Create a new discount coupon for your customers
                </p>
            </div>

            <CouponForm onSuccess={handleSuccess} />
        </div>
    );
}

