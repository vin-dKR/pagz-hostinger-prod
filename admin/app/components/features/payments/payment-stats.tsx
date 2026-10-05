'use client';

import { useEffect, useState } from 'react';
import { getPaymentStatistics, type PaymentStatistics } from '@/lib/api/payments.service';
import { formatCurrency } from '@/lib/utils/format';
import { MetricStrip, MetricTile } from '@/app/components/features/management/metric-tile';

export function PaymentStats() {
    const [stats, setStats] = useState<PaymentStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            try {
                setStats(await getPaymentStatistics());
            } catch {
                // Transaction management is still available without summary data.
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

    const successRate = stats.totalPayments > 0
        ? `${((stats.successfulPayments / stats.totalPayments) * 100).toFixed(1)}%`
        : '0%';

    return (
        <section className="space-y-4" aria-label="Payment summary">
            <MetricStrip>
                <MetricTile label="Total payments" value={stats.totalPayments.toLocaleString()} detail="All time" />
                <MetricTile label="Total amount" value={formatCurrency(stats.totalAmount)} detail="All transactions" />
                <MetricTile label="Successful" value={stats.successfulPayments.toLocaleString()} detail={formatCurrency(stats.successfulAmount)} emphasis="positive" />
                <MetricTile label="Average transaction" value={formatCurrency(stats.averageTransactionValue)} detail="Per payment" />
            </MetricStrip>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="admin-panel">
                    <div className="px-3 py-2.5 text-xs font-medium text-[var(--color-foreground-secondary)]">Payment health</div>
                    <div className="admin-panel-interior grid grid-cols-2 gap-x-5 gap-y-4 p-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                        <SummaryValue label="Success rate" value={successRate} />
                        <SummaryValue label="Pending" value={stats.pendingPayments.toLocaleString()} detail={formatCurrency(stats.pendingAmount)} />
                        <SummaryValue label="Failed" value={stats.failedPayments.toLocaleString()} detail={formatCurrency(stats.failedAmount)} />
                        <SummaryValue label="Refunded" value={stats.refundedPayments.toLocaleString()} detail={formatCurrency(stats.refundedAmount)} />
                    </div>
                </div>
                <div className="admin-panel">
                    <div className="px-3 py-2.5 text-xs font-medium text-[var(--color-foreground-secondary)]">Breakdown</div>
                    <div className="admin-panel-interior p-4">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.byStatus).map(([status, data]) => (
                            <BreakdownPill key={status} label={status} count={data.count} amount={formatCurrency(data.amount)} />
                        ))}
                    </div>
                    <div className="my-4 border-t border-[var(--color-border)]" />
                    <p className="text-xs font-medium text-[var(--color-foreground-secondary)]">By method</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(stats.byMethod).map(([method, data]) => (
                            <BreakdownPill key={method} label={method} count={data.count} amount={formatCurrency(data.amount)} />
                        ))}
                    </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function SummaryValue({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div>
            <p className="text-xs text-[var(--color-foreground-secondary)]">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-[var(--color-foreground)]">{value}</p>
            {detail && <p className="mt-0.5 text-xs text-[var(--color-foreground-tertiary)]">{detail}</p>}
        </div>
    );
}

function BreakdownPill({ label, count, amount }: { label: string; count: number; amount: string }) {
    return (
        <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-2.5 py-1.5 text-xs text-[var(--color-foreground-secondary)]">
            <span className="capitalize">{label.toLowerCase().replace(/_/g, ' ')}</span>
            <strong className="font-semibold tabular-nums text-[var(--color-foreground)]">{count}</strong>
            <span className="truncate text-[var(--color-foreground-tertiary)]">{amount}</span>
        </span>
    );
}
