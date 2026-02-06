/**
 * Dashboard Stats Component
 * Apple-inspired stat cards with clean, minimal design
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Package, ShoppingCart, DollarSign, Users, Tag, Star } from 'lucide-react';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    change?: string;
}

function StatCard({ title, value, icon, change }: StatCardProps) {
    return (
        <Card className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-[var(--color-foreground-secondary)]">{title}</CardTitle>
                <div className="text-[var(--color-foreground-tertiary)]">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold text-[var(--color-foreground)] tracking-tight">{value}</div>
                {change && (
                    <p className="text-xs text-[var(--color-foreground-tertiary)] mt-2 leading-relaxed">{change}</p>
                )}
            </CardContent>
        </Card>
    );
}

interface DashboardStatsProps {
    stats?: DashboardOverviewResponse['stats'];
    loading?: boolean;
    error?: string;
}

export function DashboardStats({ stats, loading, error }: DashboardStatsProps) {
    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Dashboard stats</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-[var(--color-destructive)]">
                        Failed to load stats: {error}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const isLoading = loading || !stats;

    const cards: StatCardProps[] = isLoading
        ? [
            {
                title: 'Total Revenue',
                value: '₹—',
                icon: <DollarSign className="h-4 w-4" />,
            },
            {
                title: "Today's Revenue",
                value: '₹—',
                icon: <DollarSign className="h-4 w-4" />,
            },
            {
                title: 'Orders',
                value: '—',
                icon: <ShoppingCart className="h-4 w-4" />,
            },
            {
                title: 'Customers',
                value: '—',
                icon: <Users className="h-4 w-4" />,
            },
        ]
        : [
            {
                title: 'Total Revenue',
                value: `₹${stats.totalRevenue.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                })}`,
                icon: <DollarSign className="h-4 w-4" />,
                change: `This month: ₹${stats.revenueThisMonth.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                })}`,
            },
            {
                title: "Today's Revenue",
                value: `₹${stats.revenueToday.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                })}`,
                icon: <DollarSign className="h-4 w-4" />,
            },
            {
                title: 'Orders',
                value: stats.totalOrders.toString(),
                icon: <ShoppingCart className="h-4 w-4" />,
                change: `Pending: ${stats.pendingOrders}, Processing: ${stats.processingOrders}, Completed: ${stats.completedOrders}`,
            },
            {
                title: 'Customers',
                value: stats.totalCustomers.toString(),
                icon: <Users className="h-4 w-4" />,
                change: `New this month: ${stats.newCustomersThisMonth}`,
            },
            {
                title: 'Products',
                value: stats
                    ? `${stats.totalActiveProducts}/${stats.totalProducts}`
                    : '—',
                icon: <Package className="h-4 w-4" />,
                change: 'Active / total products',
            },
            {
                title: 'Coupons',
                value: stats
                    ? `${stats.activeCoupons}/${stats.totalCoupons}`
                    : '—',
                icon: <Tag className="h-4 w-4" />,
                change: 'Active / total coupons',
            },
            {
                title: 'Reviews',
                value: stats ? stats.totalReviews.toString() : '—',
                icon: <Star className="h-4 w-4" />,
                change:
                    stats && stats.averageRating != null
                        ? `Avg rating: ${stats.averageRating.toFixed(1)} / 5`
                        : 'No reviews yet',
            },
        ];

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
                <StatCard key={card.title} {...card} />
            ))}
        </div>
    );
}

