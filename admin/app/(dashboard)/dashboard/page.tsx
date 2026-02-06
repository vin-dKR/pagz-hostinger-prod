/**
 * Dashboard Overview Page
 * Apple-inspired dashboard with clean layout and generous spacing
 * Server Component – data fetched on the server via helper.
 */

import { DashboardStats } from '@/app/components/features/dashboard/dashboard-stats';
import { RecentOrders } from '@/app/components/features/dashboard/recent-orders';
import { RevenueChart } from '@/app/components/features/dashboard/revenue-chart';
import { OrdersTrendChart } from '@/app/components/features/dashboard/orders-trend-chart';
import { TopProducts } from '@/app/components/features/dashboard/top-products';
import { RecentCustomers } from '@/app/components/features/dashboard/recent-customers';
import { RecentCoupons } from '@/app/components/features/dashboard/recent-coupons';
import { getDashboardOverview } from '@/lib/server/dashboard-data';

export default async function DashboardPage() {
    const data = await getDashboardOverview();

    return (
        <div className="space-y-8 max-w-[1600px]">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Dashboard</h1>
                <p className="text-sm text-[var(--color-foreground-secondary)]">
                    Overview of your e-print store
                </p>
            </header>

            {/* Top stats */}
            <DashboardStats
                stats={data?.stats}
                loading={!data}
            />

            {/* Charts row */}
            <div className="grid gap-6 md:grid-cols-2">
                <RevenueChart
                    data={data?.timeSeries.revenueLast30Days || []}
                    loading={!data}
                />
                <OrdersTrendChart
                    data={data?.timeSeries.ordersLast30Days || []}
                    loading={!data}
                />
            </div>

            {/* Tables / lists row */}
            <div className="grid gap-6 md:grid-cols-2">
                <RecentOrders
                    recentOrders={data?.recentOrders || []}
                    loading={!data}
                />
                <TopProducts
                    topProducts={data?.topProducts || []}
                    loading={!data}
                />
            </div>

            {/* Secondary row */}
            <div className="grid gap-6 md:grid-cols-2">
                <RecentCustomers
                    recentCustomers={data?.recentCustomers || []}
                    loading={!data}
                />
                <RecentCoupons
                    recentCoupons={data?.recentCoupons || []}
                    loading={!data}
                />
            </div>
        </div>
    );
}

