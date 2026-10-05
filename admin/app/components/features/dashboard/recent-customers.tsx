import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { UsersRound } from 'lucide-react';

interface RecentCustomersProps {
    recentCustomers: DashboardOverviewResponse['recentCustomers'];
    loading?: boolean;
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function RecentCustomers({ recentCustomers, loading }: RecentCustomersProps) {
    return (
        <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
            <div className="flex min-h-[54px] items-center gap-2.5 px-2.5 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#dedede] bg-white text-[#565656] shadow-[0_1px_1px_#0000000a]" aria-hidden="true"><UsersRound className="h-4 w-4" /></span>
                <div>
                    <h2 className="text-sm font-semibold tracking-[-0.02em] text-[#252525]">Recent customers</h2>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#858585]">Newly joined accounts</p>
                </div>
            </div>
            {loading && !recentCustomers.length ? (
                <div className="space-y-3 rounded-[6px] border border-[#e1e1e1] bg-white p-5">
                    {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-[4px] bg-[#f1f1f1]" />)}
                </div>
            ) : !recentCustomers.length ? (
                <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-5 py-12 text-center text-sm text-[#858585]">No customers yet</div>
            ) : (
                <div className="divide-y divide-[#ececec] rounded-[6px] border border-[#e1e1e1] bg-white px-4 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a]">
                    {recentCustomers.map((customer) => (
                        <div key={customer.id} className="flex min-w-0 items-center gap-3 py-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-[#e3e3e3] bg-[#f4f4f4] text-xs font-bold uppercase text-[#575757]" aria-hidden="true">
                                {customer.name.trim().charAt(0) || 'C'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[var(--color-foreground)]" title={customer.name}>{customer.name}</p>
                                <p className="mt-0.5 truncate text-[11px] text-[var(--color-foreground-tertiary)]" title={customer.email}>{customer.email}</p>
                                <p className="mt-1 text-[11px] text-[var(--color-foreground-tertiary)]">Joined {formatDate(customer.createdAt)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-xs font-bold tabular-nums text-[var(--color-foreground)]">₹{customer.totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                <p className="mt-0.5 text-[11px] text-[var(--color-foreground-tertiary)]">{customer.totalOrders} orders</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
