/**
 * Coupons Management Page
 * List and manage discount coupons
 */

import { CouponsListEnhanced } from '@/app/components/features/coupons/coupons-list-enhanced';
import { CouponStats } from '@/app/components/features/coupons/coupon-stats';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { Plus, Download } from 'lucide-react';

export default function CouponsPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Discount Management</h1>
                    <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                        Create and manage discount coupons and promotional offers
                    </p>
                </div>
                <div className="">
                    <Link href="/coupons/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Coupon
                        </Button>
                    </Link>
                </div>
            </div>

            <CouponStats />
            <CouponsListEnhanced />
        </div>
    );
}

