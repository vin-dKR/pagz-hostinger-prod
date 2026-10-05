import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { TicketPercent } from 'lucide-react';

interface RecentCouponsProps {
    recentCoupons: DashboardOverviewResponse['recentCoupons'];
    loading?: boolean;
}

function formatDate(value?: string | null) {
    if (!value) return 'No expiry';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function RecentCoupons({ recentCoupons, loading }: RecentCouponsProps) {
    return (
        <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
            <div className="flex min-h-[54px] items-center gap-2.5 px-2.5 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#dedede] bg-white text-[#565656] shadow-[0_1px_1px_#0000000a]" aria-hidden="true"><TicketPercent className="h-4 w-4" /></span>
                <div>
                    <h2 className="text-sm font-semibold tracking-[-0.02em] text-[#252525]">Recent coupons</h2>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#858585]">Offers and redemption activity</p>
                </div>
            </div>
            {loading && !recentCoupons.length ? (
                <div className="space-y-3 rounded-[6px] border border-[#e1e1e1] bg-white p-5">
                    {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-[4px] bg-[#f1f1f1]" />)}
                </div>
            ) : !recentCoupons.length ? (
                <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-5 py-12 text-center text-sm text-[#858585]">No coupons created yet</div>
            ) : (
                <div className="divide-y divide-[#ececec] rounded-[6px] border border-[#e1e1e1] bg-white px-4 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a]">
                    {recentCoupons.map((coupon) => (
                        <div key={coupon.id} className="flex min-w-0 items-start justify-between gap-3 py-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate font-mono text-xs font-bold tracking-[0.04em] text-[var(--color-foreground)]" title={coupon.code}>{coupon.code}</p>
                                    <span className="shrink-0 rounded-[3px] bg-[#edf0f8] px-1.5 py-0.5 text-[10px] font-bold text-[#565ba8]">
                                        {coupon.discountType === 'PERCENTAGE' ? coupon.discountValue + '%' : '₹' + coupon.discountValue} off
                                    </span>
                                </div>
                                <p className="mt-1.5 text-[11px] text-[var(--color-foreground-secondary)]">
                                    Used {coupon.usageCount}{coupon.maxUsage ? ' / ' + coupon.maxUsage : ''} times
                                    <span className="px-1.5 text-[var(--color-foreground-tertiary)]">·</span>
                                    Expires {formatDate(coupon.expiresAt)}
                                </p>
                                {coupon.maxUsage != null && coupon.maxUsage > 0 && (
                                    <div className="mt-2 flex h-[5px] gap-[2px] overflow-hidden" aria-hidden="true">
                                        {Array.from({ length: 18 }).map((_, segment) => <span key={segment} className="h-full min-w-0 flex-1 rounded-[1px]" style={{ backgroundColor: segment < Math.max(0, Math.min(18, coupon.usageCount / (coupon.maxUsage ?? 1) * 18)) ? '#6c91d8' : '#e8e8e8' }} />)}
                                    </div>
                                )}
                            </div>
                            <span className={'inline-flex shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ' + (coupon.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)]')}>
                                {coupon.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
