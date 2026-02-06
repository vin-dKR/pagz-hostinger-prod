import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface RecentCouponsProps {
    recentCoupons: DashboardOverviewResponse['recentCoupons'];
    loading?: boolean;
}

function formatDate(dateStr?: string | null) {
    if (!dateStr) return 'No expiry';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

export function RecentCoupons({ recentCoupons, loading }: RecentCouponsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Coupons</CardTitle>
            </CardHeader>
            <CardContent>
                {loading && !recentCoupons.length ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-10 animate-pulse rounded-md bg-gray-100"
                            />
                        ))}
                    </div>
                ) : !recentCoupons.length ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No coupons created yet
                    </p>
                ) : (
                    <div className="space-y-3 text-sm">
                        {recentCoupons.map((coupon) => (
                            <div
                                key={coupon.id}
                                className="flex items-center justify-between gap-3"
                            >
                                <div>
                                    <p className="font-mono text-xs uppercase tracking-wide">
                                        {coupon.code}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {coupon.discountType === 'PERCENTAGE'
                                            ? `${coupon.discountValue}% off`
                                            : `₹${coupon.discountValue} off`}{' '}
                                        • Used {coupon.usageCount}
                                        {coupon.maxUsage ? ` / ${coupon.maxUsage}` : ''} times
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Expires {formatDate(coupon.expiresAt)}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${coupon.isActive
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {coupon.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


