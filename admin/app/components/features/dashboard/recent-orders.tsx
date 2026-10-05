'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Check, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { updateOrderStatus } from '@/lib/api/orders.service';
import { toastSuccess, toastError } from '@/lib/utils/toast';

interface RecentOrdersProps {
    recentOrders: DashboardOverviewResponse['recentOrders'];
    loading?: boolean;
    error?: string;
    onOrderUpdate?: () => void;
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function statusClasses(status: string) {
    switch (status) {
        case 'DELIVERED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'CANCELLED':
        case 'REJECTED': return 'bg-red-50 text-red-700 border-red-200';
        case 'PENDING_REVIEW': return 'bg-amber-50 text-amber-800 border-amber-200';
        case 'ACCEPTED':
        case 'PROCESSING': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'SHIPPED': return 'bg-sky-50 text-sky-700 border-sky-200';
        default: return 'bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] border-[var(--color-border)]';
    }
}

function paymentClasses(status: string) {
    switch (status) {
        case 'PAID': return 'text-emerald-700';
        case 'FAILED':
        case 'REFUNDED': return 'text-red-700';
        case 'PENDING': return 'text-amber-700';
        default: return 'text-[var(--color-foreground-secondary)]';
    }
}

export function RecentOrders({ recentOrders, loading, error, onOrderUpdate }: RecentOrdersProps) {
    const router = useRouter();
    const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

    const handleApprove = async (orderId: string) => {
        try {
            setApprovingOrderId(orderId);
            await updateOrderStatus(orderId, { status: 'ACCEPTED' });
            toastSuccess('Order approved successfully');
            router.refresh();
            onOrderUpdate?.();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to approve order');
        } finally {
            setApprovingOrderId(null);
        }
    };

    return (
        <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
            <div className="flex min-h-[54px] flex-wrap items-center justify-between gap-3 px-2.5 py-2">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#dedede] bg-white text-[#4e4e4e] shadow-[0_1px_1px_#0000000a]" aria-hidden="true"><ShoppingBag className="h-4 w-4" /></span>
                    <div>
                        <h2 className="text-sm font-semibold tracking-[-0.025em] text-[#252525]">Latest orders</h2>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#858585]">Recent transactions</p>
                    </div>
                </div>
                <Link href="/orders" className="inline-flex items-center gap-1.5 rounded-[5px] border border-[#dedede] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#393939] shadow-[0_1px_1px_#0000000a] hover:bg-[#f9f9f9]">
                    View all orders <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
            </div>
            {error ? (
                <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-6 py-12 text-center text-sm text-[var(--color-destructive)]">Failed to load recent orders: {error}</div>
            ) : loading ? (
                <div className="space-y-3 rounded-[6px] border border-[#e1e1e1] bg-white p-6">
                    {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-[4px] bg-[#f1f1f1]" />)}
                </div>
            ) : recentOrders.length === 0 ? (
                <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-6 py-12 text-center text-sm text-[#858585]">No orders yet</div>
            ) : (
                <div className="overflow-x-auto rounded-[6px] border border-[#e1e1e1] bg-white shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a]">
                    <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                        <thead className="bg-[#f7f7f7] font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-[#777]">
                            <tr>
                                <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Order</th>
                                <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                                <th scope="col" className="px-4 py-3 text-center font-semibold">Items</th>
                                <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                                <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                                <th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ececec]">
                            {recentOrders.slice(0, 6).map((order) => (
                                <tr key={order.id} className="transition-colors hover:bg-[#fafafa]">
                                    <td className="px-5 py-3 sm:px-6">
                                        <Link href={'/orders/' + order.id} title={order.orderNumber} className="block max-w-[160px] truncate font-mono text-[11px] font-semibold tabular-nums text-[#5257a3] hover:underline">{order.orderNumber}</Link>
                                    </td>
                                    <td className="max-w-60 px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[#e4e4e4] bg-[#f5f5f5] text-[11px] font-bold uppercase text-[#595959]" aria-hidden="true">{order.customerName.trim().charAt(0) || 'C'}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold text-[var(--color-foreground)]">{order.customerName}</p>
                                                {order.customerEmail && <p className="mt-0.5 truncate text-[11px] text-[var(--color-foreground-tertiary)]">{order.customerEmail}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-foreground-secondary)]">{formatDate(order.createdAt)}</td>
                                    <td className="px-4 py-3 text-center text-xs font-medium tabular-nums text-[var(--color-foreground-secondary)]">{order.itemCount}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold tabular-nums text-[var(--color-foreground)]">
                                        ₹{order.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em]">
                                        {order.paymentStatus ? <span className={paymentClasses(order.paymentStatus)}>{order.paymentStatus.replaceAll('_', ' ')}</span> : <span className="text-[var(--color-foreground-tertiary)]">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={'inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold ' + statusClasses(order.status)}>
                                            {order.status.replaceAll('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right sm:px-6">
                                        {order.status === 'PENDING_REVIEW' ? (
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => handleApprove(order.id)}
                                                disabled={approvingOrderId === order.id}
                                                className="h-8 w-8 border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                                                title="Approve order"
                                                aria-label={'Approve order ' + order.orderNumber}
                                            >
                                                {approvingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            </Button>
                                        ) : <span className="text-[var(--color-foreground-tertiary)]">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
