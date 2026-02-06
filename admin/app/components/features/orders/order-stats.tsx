/**
 * Order Statistics Dashboard Component
 * Displays order statistics at the top of the orders page
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Spinner } from '@/app/components/ui/loading';
import { getOrderStatistics, type OrderStatistics } from '@/lib/api/orders.service';
import { formatCurrency } from '@/lib/utils/format';
import { AlertCircle, DollarSign, Package, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

export function OrderStats() {
    const [stats, setStats] = useState<OrderStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getOrderStatistics();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load statistics');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-center h-20">
                                <Spinner size="sm" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error || !stats) {
        return null;
    }

    return (
        <div className="space-y-6 mb-6">
            {/* Main Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                                <p className="text-3xl font-bold mt-2">{stats.totalOrders}</p>
                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                    <span>Today: {stats.orders.today}</span>
                                    <span>Week: {stats.orders.week}</span>
                                    <span>Month: {stats.orders.month}</span>
                                </div>
                            </div>
                            <Package className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                                <p className="text-3xl font-bold mt-2">{formatCurrency(stats.totalRevenue)}</p>
                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                    <span>Today: {formatCurrency(stats.revenue.today)}</span>
                                    <span>Week: {formatCurrency(stats.revenue.week)}</span>
                                    <span>Month: {formatCurrency(stats.revenue.month)}</span>
                                </div>
                            </div>
                            <DollarSign className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                                <p className="text-3xl font-bold mt-2">{formatCurrency(stats.averageOrderValue)}</p>
                                <p className="text-xs text-gray-500 mt-2">Based on successful payments</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Requires Attention</p>
                                <p className="text-3xl font-bold mt-2 text-orange-600">{stats.ordersRequiringAttention}</p>
                                <p className="text-xs text-gray-500 mt-2">Pending review or failed payments</p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Orders by Status */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Orders by Status</h3>
                    <div className="flex flex-wrap gap-3">
                        {stats.ordersByStatus.map((item) => (
                            <Badge
                                key={item.status}
                                variant="secondary"
                                className="px-4 py-2 text-sm"
                            >
                                <span className="capitalize">{item.status.replace(/_/g, ' ').toLowerCase()}</span>
                                <span className="ml-2 font-bold">{item.count}</span>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Pending Payments */}
            {stats.pendingPaymentsCount > 0 && (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-yellow-500" />
                            <div>
                                <p className="font-medium">Pending Payments</p>
                                <p className="text-sm text-gray-600">
                                    {stats.pendingPaymentsCount} order{stats.pendingPaymentsCount !== 1 ? 's' : ''} with pending payments
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

