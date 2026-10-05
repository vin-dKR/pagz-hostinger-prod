'use client';

import { useEffect, useState } from 'react';
import { getOrderStatistics, type OrderStatistics } from '@/lib/api/orders.service';
import { formatCurrency } from '@/lib/utils/format';
import { MetricStrip, MetricTile } from '@/app/components/features/management/metric-tile';

export function OrderStats() {
    const [stats, setStats] = useState<OrderStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            try {
                setStats(await getOrderStatistics());
            } catch {
                // The order list remains usable if summary data is unavailable.
            } finally {
                setIsLoading(false);
            }
        };
        void loadStats();
    }, []);

    if (isLoading) {
        return <div className="h-32 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]" />;
    }
    if (!stats) return null;

    return (
        <section className="space-y-4" aria-label="Order summary">
            <MetricStrip>
                <MetricTile
                    label="Total orders"
                    value={stats.totalOrders.toLocaleString()}
                    detail={`${stats.orders.today} today · ${stats.orders.week} this week`}
                />
                <MetricTile
                    label="Total revenue"
                    value={formatCurrency(stats.totalRevenue)}
                    detail={`${formatCurrency(stats.revenue.today)} today · ${formatCurrency(stats.revenue.month)} this month`}
                />
                <MetricTile
                    label="Average order value"
                    value={formatCurrency(stats.averageOrderValue)}
                    detail="Based on successful payments"
                />
                <MetricTile
                    label="Requires attention"
                    value={stats.ordersRequiringAttention.toLocaleString()}
                    detail="Pending review or failed payments"
                    emphasis={stats.ordersRequiringAttention > 0 ? 'warning' : 'default'}
                />
            </MetricStrip>

            <div className="admin-panel">
                <div className="admin-panel-interior flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[11px] font-medium text-[var(--color-foreground-tertiary)]">By status</span>
                    {stats.ordersByStatus.map((item) => (
                        <span key={item.status} className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[#fafafa] px-2.5 py-1 text-xs text-[var(--color-foreground-secondary)]">
                            <span className="capitalize">{item.status.replace(/_/g, ' ').toLowerCase()}</span>
                            <strong className="font-semibold tabular-nums text-[var(--color-foreground)]">{item.count}</strong>
                        </span>
                    ))}
                </div>
                {stats.pendingPaymentsCount > 0 && (
                    <p className="shrink-0 text-xs font-medium text-[var(--color-warning)]">
                        {stats.pendingPaymentsCount} pending payment{stats.pendingPaymentsCount !== 1 ? 's' : ''}
                    </p>
                )}
                </div>
            </div>
        </section>
    );
}
