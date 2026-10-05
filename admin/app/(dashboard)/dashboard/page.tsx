import { DashboardStats } from '@/app/components/features/dashboard/dashboard-stats';
import { RecentOrders } from '@/app/components/features/dashboard/recent-orders';
import { RevenueChart } from '@/app/components/features/dashboard/revenue-chart';
import { OrdersTrendChart } from '@/app/components/features/dashboard/orders-trend-chart';
import { TopProducts } from '@/app/components/features/dashboard/top-products';
import { RecentCustomers } from '@/app/components/features/dashboard/recent-customers';
import { RecentCoupons } from '@/app/components/features/dashboard/recent-coupons';
import { getDashboardOverview } from '@/lib/server/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    let data;
    try {
        data = await getDashboardOverview();
    } catch (error) {
        console.error('[DASHBOARD] Error loading dashboard data:', error);
        data = null;
    }

    return (
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 pb-12 lg:gap-4">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dedede] pb-3">
                <div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[10px] font-medium text-[#999]">01 /</span>
                        <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.04em] text-[#252525] sm:text-[28px]">Dashboard</h1>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#777]">
                        Your store performance and recent activity at a glance.
                    </p>
                </div>
            </header>

            <section aria-label="Store metrics">
                <DashboardStats stats={data?.stats} timeSeries={data?.timeSeries} loading={!data} />
            </section>

            <section aria-label="Sales analytics" className="grid min-w-0 gap-3 xl:grid-cols-2">
                <RevenueChart data={data?.timeSeries.revenueLast30Days || []} loading={!data} />
                <OrdersTrendChart data={data?.timeSeries.ordersLast30Days || []} loading={!data} />
            </section>

            <section aria-label="Recent store activity" className="space-y-3">
                <RecentOrders recentOrders={data?.recentOrders || []} loading={!data} />
                <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    <TopProducts topProducts={data?.topProducts || []} loading={!data} />
                    <RecentCustomers recentCustomers={data?.recentCustomers || []} loading={!data} />
                    <RecentCoupons recentCoupons={data?.recentCoupons || []} loading={!data} />
                </div>
            </section>
        </div>
    );
}
