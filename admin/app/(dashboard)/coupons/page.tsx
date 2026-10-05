/**
 * Coupons Management Page
 * List and manage discount coupons
 */

import { CouponsListEnhanced } from '@/app/components/features/coupons/coupons-list-enhanced';
import { CouponStats } from '@/app/components/features/coupons/coupon-stats';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function CouponsPage() {
    return (
        <ManagementPage
            section="Commerce / Promotions"
            title="Coupons"
            description="Create and manage discounts and promotional offers."
            actions={
                    <Link href="/coupons/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Coupon
                        </Button>
                    </Link>
            }
        >
            <CouponStats />
            <CouponsListEnhanced />
        </ManagementPage>
    );
}
