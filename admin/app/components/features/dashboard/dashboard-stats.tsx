import { Package, ShoppingBag, Users, TicketPercent, Star, Wallet, Sunrise } from 'lucide-react';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface DashboardStatsProps {
    stats?: DashboardOverviewResponse['stats'];
    timeSeries?: DashboardOverviewResponse['timeSeries'];
    loading?: boolean;
    error?: string;
}

const money = (value: number) => '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 0 });

function MiniDotBars({ values, color }: { values: number[]; color: string }) {
    const sample = values.slice(-16);
    const maximum = Math.max(1, ...sample);

    return (
        <div className="flex h-[42px] shrink-0 items-end gap-[3px]" aria-hidden="true">
            {sample.map((value, index) => {
                const filled = value > 0 ? Math.max(1, Math.round(value / maximum * 6)) : 0;
                return (
                    <div key={index} className="flex flex-col-reverse gap-[2px]">
                        {Array.from({ length: 6 }).map((_, level) => (
                            <span key={level} className="h-[4px] w-[4px] rounded-[1px]" style={{ backgroundColor: level < filled ? color : '#e9e9e9' }} />
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

function MiniStripeBars({ values, color }: { values: number[]; color: string }) {
    const sample = values.slice(-14);
    const maximum = Math.max(1, ...sample);

    return (
        <div className="flex h-[42px] shrink-0 items-end gap-[3px]" aria-hidden="true">
            {sample.map((value, index) => (
                <span
                    key={index}
                    className="w-[5px] rounded-t-[1px] border-b-2 border-[#dddddd]"
                    style={{ height: `${Math.max(4, value / maximum * 42)}px`, backgroundColor: value > 0 ? color : '#ededed', opacity: value > 0 ? 0.45 + index / Math.max(1, sample.length - 1) * 0.5 : 1 }}
                />
            ))}
        </div>
    );
}

function MiniSegments({ fraction, color, count = 20 }: { fraction: number; color: string; count?: number }) {
    const filled = Math.max(0, Math.min(count, Math.round(fraction * count)));
    return (
        <div className="grid w-[90px] shrink-0 grid-cols-10 gap-[3px]" aria-hidden="true">
            {Array.from({ length: count }).map((_, index) => (
                <span key={index} className="h-[7px] rounded-[1px]" style={{ backgroundColor: index < filled ? color : '#e8e8e8' }} />
            ))}
        </div>
    );
}

function SegmentTrack({ fraction, color }: { fraction: number; color: string }) {
    const filled = Math.max(0, Math.min(18, Math.round(fraction * 18)));
    return (
        <div className="mt-2 flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
                <span key={index} className="h-[5px] min-w-0 flex-1 rounded-[1px]" style={{ backgroundColor: index < filled ? color : '#e8e8e8' }} />
            ))}
        </div>
    );
}

export function DashboardStats({ stats, timeSeries, loading, error }: DashboardStatsProps) {
    if (error) {
        return <div className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">Failed to load dashboard stats: {error}</div>;
    }

    const isLoading = loading || !stats;
    const revenue = timeSeries?.revenueLast30Days.map((item) => item.revenue) || [];
    const orders = timeSeries?.ordersLast30Days.map((item) => item.count) || [];
    const activeProducts = stats && stats.totalProducts > 0 ? stats.totalActiveProducts / stats.totalProducts : 0;
    const activeCoupons = stats && stats.totalCoupons > 0 ? stats.activeCoupons / stats.totalCoupons : 0;
    const newCustomers = stats && stats.totalCustomers > 0 ? stats.newCustomersThisMonth / stats.totalCustomers : 0;

    const primary = [
        {
            label: 'Total revenue',
            value: stats ? money(stats.totalRevenue) : '₹—',
            detail: stats ? money(stats.revenueThisMonth) + ' this month' : 'This month —',
            icon: Wallet,
            color: '#7879e8',
            visual: <MiniDotBars values={revenue} color="#7879e8" />,
        },
        {
            label: 'Revenue today',
            value: stats ? money(stats.revenueToday) : '₹—',
            detail: 'Daily revenue · last 14 days',
            icon: Sunrise,
            color: '#6c91d8',
            visual: <MiniStripeBars values={revenue} color="#6c91d8" />,
        },
        {
            label: 'Total orders',
            value: stats ? stats.totalOrders.toLocaleString('en-IN') : '—',
            detail: stats ? stats.pendingOrders + ' pending · ' + stats.processingOrders + ' processing · ' + stats.completedOrders + ' completed' : 'Pending — · Processing — · Completed —',
            icon: ShoppingBag,
            color: '#6c91d8',
            visual: <MiniDotBars values={orders} color="#6c91d8" />,
        },
        {
            label: 'Customers',
            value: stats ? stats.totalCustomers.toLocaleString('en-IN') : '—',
            detail: stats ? stats.newCustomersThisMonth + ' new this month' : 'New this month —',
            icon: Users,
            color: '#69a589',
            visual: <MiniSegments fraction={newCustomers} color="#69a589" />,
        },
    ];

    return (
        <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                {primary.map(({ label, value, detail, icon: Icon, color, visual }, index) => (
                    <div key={label} className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
                        <div className="flex h-7 items-center justify-between gap-2 px-2">
                            <span className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[#575757]"><span className="hidden sm:inline">{String(index + 1).padStart(2, '0')} / </span>{label}</span>
                            <Icon className="h-[14px] w-[14px] shrink-0" style={{ color }} aria-hidden="true" />
                        </div>
                        <div className="flex min-h-[77px] items-end justify-between gap-2 rounded-[6px] border border-[#e1e1e1] bg-white px-3 pb-3 pt-2 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a]">
                            <p className={'min-w-0 truncate text-[25px] font-semibold leading-none tracking-[-0.05em] tabular-nums text-[#252525] sm:text-[29px] ' + (isLoading ? 'animate-pulse' : '')}>{value}</p>
                            <div className="hidden sm:block">{visual}</div>
                        </div>
                        <p className="min-h-[28px] px-2 pt-2 text-[10px] leading-[14px] text-[#747474] sm:text-[11px]">{detail}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
                <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
                    <div className="flex h-6 items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#616161]"><Package className="h-3 w-3 text-[#7879e8]" aria-hidden="true" />Products</div>
                    <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-2.5 py-2 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a] sm:px-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-lg font-semibold leading-none tabular-nums text-[#252525] sm:text-xl">{stats?.totalProducts.toLocaleString('en-IN') ?? '—'}</span><span className="text-[10px] text-[#777]">{stats ? stats.totalActiveProducts + ' active' : '— active'}</span></div>
                        <SegmentTrack fraction={activeProducts} color="#7879e8" />
                    </div>
                </div>
                <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
                    <div className="flex h-6 items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#616161]"><TicketPercent className="h-3 w-3 text-[#6c91d8]" aria-hidden="true" />Coupons</div>
                    <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-2.5 py-2 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a] sm:px-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-lg font-semibold leading-none tabular-nums text-[#252525] sm:text-xl">{stats?.totalCoupons.toLocaleString('en-IN') ?? '—'}</span><span className="text-[10px] text-[#777]">{stats ? stats.activeCoupons + ' active' : '— active'}</span></div>
                        <SegmentTrack fraction={activeCoupons} color="#6c91d8" />
                    </div>
                </div>
                <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
                    <div className="flex h-6 items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#616161]"><Star className="h-3 w-3 text-[#bd944b]" aria-hidden="true" />Reviews</div>
                    <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-2.5 py-2 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a] sm:px-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-lg font-semibold leading-none tabular-nums text-[#252525] sm:text-xl">{stats?.totalReviews.toLocaleString('en-IN') ?? '—'}</span><span className="text-[10px] text-[#777]">{stats?.averageRating != null ? stats.averageRating.toFixed(1) + ' avg' : 'No rating'}</span></div>
                        <div className="mt-2 flex h-[5px] items-center gap-1" aria-hidden="true">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={'h-2.5 w-2.5 ' + (stats?.averageRating != null && index < Math.round(stats.averageRating) ? 'fill-[#bd944b] text-[#bd944b]' : 'text-[#d4d4d4]')} />)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
