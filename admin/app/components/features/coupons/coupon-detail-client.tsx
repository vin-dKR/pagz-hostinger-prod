/**
 * Coupon Detail Client Component
 * Optimized with TanStack Query and improved preview UI
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
    useCoupon,
    useCouponAnalytics,
    useCouponUsages,
} from '@/lib/hooks/use-coupons';
import type { Coupon, CouponAnalytics, CouponUsage } from '@/lib/api/coupons.service';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { Edit, ArrowLeft, Users, TrendingUp, DollarSign, Copy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/app/components/ui/table';
import { CouponStatusBadge } from '@/app/components/ui/coupon-status-badge';
import { CouponDiscountDisplay } from '@/app/components/ui/coupon-discount-display';
import { LoadingState } from '@/app/components/ui/loading-state';
import { ErrorState } from '@/app/components/ui/error-state';
import { toastSuccess } from '@/lib/utils/toast';

interface CouponDetailClientProps {
    couponId: string;
    initialCoupon?: Coupon;
    initialAnalytics?: CouponAnalytics;
    initialUsages?: CouponUsage[];
    initialUsagePagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export function CouponDetailClient({
    couponId,
    initialCoupon,
    initialAnalytics,
    initialUsages = [],
    initialUsagePagination = { page: 1, limit: 20, total: 0, totalPages: 0 },
}: CouponDetailClientProps) {
    const router = useRouter();
    const [usagePage, setUsagePage] = useState(initialUsagePagination.page);
    const [copied, setCopied] = useState(false);

    // Use TanStack Query with initial data
    const {
        data: coupon,
        isLoading: loadingCoupon,
        error: couponError,
    } = useCoupon(couponId);

    const { data: analytics } = useCouponAnalytics(couponId);

    const {
        data: usagesData,
        isLoading: loadingUsages,
    } = useCouponUsages(couponId, usagePage, 20);

    // Use query data if available, otherwise fall back to initial data
    // This ensures we always show the latest data from the API
    const displayCoupon = coupon || initialCoupon;
    const displayAnalytics = analytics || initialAnalytics;
    // Always use query data when available, only use initial data as fallback when query hasn't loaded yet
    const displayUsages = usagesData?.usages ?? (loadingUsages && !usagesData ? initialUsages : []);
    const displayPagination = usagesData?.pagination ?? initialUsagePagination;

    const handleCopyCode = () => {
        if (displayCoupon) {
            navigator.clipboard.writeText(displayCoupon.code);
            setCopied(true);
            toastSuccess('Coupon code copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loadingCoupon && !initialCoupon) {
        return <LoadingState message="Loading coupon details..." />;
    }

    if (couponError && !initialCoupon) {
        return (
            <ErrorState
                message={couponError instanceof Error ? couponError.message : 'Failed to load coupon'}
            />
        );
    }

    if (!displayCoupon) {
        return <ErrorState message="Coupon not found" />;
    }

    const usageCount = (displayCoupon as Coupon & { _count?: { usages: number } })?._count?.usages || 0;
    const usageLimit = displayCoupon.usageLimit;
    const remainingUses = usageLimit ? Math.max(0, usageLimit - usageCount) : null;

    return (
        <div className="space-y-6">
            {/* Header with Quick Info */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="cursor-pointer">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{displayCoupon.name}</h1>
                        <div className="mt-2 flex items-center gap-3">
                            <p className="font-mono text-lg font-semibold text-gray-700">
                                {displayCoupon.code}
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyCode}
                                className="cursor-pointer"
                            >
                                {copied ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                            <CouponStatusBadge
                                isActive={displayCoupon.isActive}
                                validFrom={displayCoupon.validFrom}
                                validUntil={displayCoupon.validUntil}
                                showIcon
                                size="md"
                            />
                        </div>
                    </div>
                </div>
                <Link href={`/coupons/${displayCoupon.id}/edit`}>
                    <Button className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Coupon
                    </Button>
                </Link>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-600">Discount</p>
                                <CouponDiscountDisplay
                                    discountType={displayCoupon.discountType}
                                    discountValue={Number(displayCoupon.discountValue)}
                                    maxDiscountAmount={
                                        displayCoupon.maxDiscountAmount
                                            ? Number(displayCoupon.maxDiscountAmount)
                                            : null
                                    }
                                    size="lg"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div>
                            <p className="text-xs text-gray-600">Total Uses</p>
                            <p className="text-2xl font-bold text-gray-900">{usageCount}</p>
                            {usageLimit && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {remainingUses} remaining
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div>
                            <p className="text-xs text-gray-600">Valid Until</p>
                            <p className="text-sm font-semibold text-gray-900">
                                {formatDate(displayCoupon.validUntil)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(displayCoupon.validUntil) > new Date()
                                    ? 'Active'
                                    : 'Expired'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div>
                            <p className="text-xs text-gray-600">Applicable To</p>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                                {displayCoupon.applicableTo === 'ALL'
                                    ? 'All Products'
                                    : displayCoupon.applicableTo.toLowerCase()}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Coupon Details & Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Coupon Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {displayCoupon.description && (
                            <div>
                                <p className="text-sm text-gray-600">Description</p>
                                <p className="mt-1">{displayCoupon.description}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-gray-600">Valid From</p>
                            <p className="mt-1">{formatDate(displayCoupon.validFrom)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Valid Until</p>
                            <p className="mt-1">{formatDate(displayCoupon.validUntil)}</p>
                        </div>
                        {displayCoupon.minPurchaseAmount && (
                            <div>
                                <p className="text-sm text-gray-600">Minimum Purchase</p>
                                <p className="mt-1">{formatCurrency(Number(displayCoupon.minPurchaseAmount))}</p>
                            </div>
                        )}
                        {displayCoupon.maxDiscountAmount && (
                            <div>
                                <p className="text-sm text-gray-600">Maximum Discount</p>
                                <p className="mt-1">{formatCurrency(Number(displayCoupon.maxDiscountAmount))}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-gray-600">Usage Limit</p>
                            <p className="mt-1">
                                {usageLimit ? `${usageCount} / ${usageLimit}` : 'Unlimited'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Usage Limit Per User</p>
                            <p className="mt-1">{displayCoupon.usageLimitPerUser}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Analytics */}
                {displayAnalytics && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Analytics</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="h-5 w-5 text-blue-600" />
                                        <p className="text-sm text-gray-600">Total Uses</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{displayAnalytics.totalUses}</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="h-5 w-5 text-green-600" />
                                        <p className="text-sm text-gray-600">Unique Users</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{displayAnalytics.uniqueUsers}</p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="h-5 w-5 text-purple-600" />
                                        <p className="text-sm text-gray-600">Total Discount</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {formatCurrency(displayAnalytics.totalDiscount)}
                                    </p>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="h-5 w-5 text-orange-600" />
                                        <p className="text-sm text-gray-600">Average Discount</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {formatCurrency(displayAnalytics.averageDiscount)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Usage History */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage History</CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingUsages && !initialUsages.length ? (
                        <LoadingState message="Loading usage history..." size="sm" />
                    ) : displayUsages.length === 0 ? (
                        <p className="text-center text-gray-600 py-8">No usage history yet</p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Order ID</TableHead>
                                            <TableHead>Discount Amount</TableHead>
                                            <TableHead>Used At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayUsages.map((usage) => (
                                            <TableRow key={usage.id}>
                                                <TableCell>{usage.user.name || 'N/A'}</TableCell>
                                                <TableCell>{usage.user.email}</TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {usage.orderId || 'N/A'}
                                                </TableCell>
                                                <TableCell>{formatCurrency(usage.discountAmount)}</TableCell>
                                                <TableCell>{formatDate(usage.usedAt)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {displayPagination.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-sm text-gray-600">
                                        Page {usagePage} of {displayPagination.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setUsagePage((p) => Math.max(1, p - 1))}
                                            disabled={usagePage === 1}
                                            className="cursor-pointer"
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setUsagePage((p) =>
                                                    Math.min(displayPagination.totalPages, p + 1)
                                                )
                                            }
                                            disabled={usagePage === displayPagination.totalPages}
                                            className="cursor-pointer"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
