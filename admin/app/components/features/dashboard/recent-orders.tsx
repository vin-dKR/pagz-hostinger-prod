/**
 * Recent Orders Component
 * Displays list of recent orders
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface RecentOrdersProps {
    recentOrders: DashboardOverviewResponse['recentOrders'];
    loading?: boolean;
    error?: string;
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString();
}

export function RecentOrders({ recentOrders, loading, error }: RecentOrdersProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Recent Orders</CardTitle>
                    <Link
                        href="/orders"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        View all
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                {error ? (
                    <p className="text-sm text-red-600 text-center py-4">
                        Failed to load recent orders: {error}
                    </p>
                ) : loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-10 animate-pulse rounded-md bg-gray-100"
                            />
                        ))}
                    </div>
                ) : recentOrders.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No orders yet
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div className="text-xs font-medium text-gray-500 grid grid-cols-5 gap-3">
                            <span>Order #</span>
                            <span>Customer</span>
                            <span>Date</span>
                            <span className="text-right">Total</span>
                            <span className="text-right">Status</span>
                        </div>
                        <div className="space-y-3">
                            {recentOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="grid grid-cols-5 items-center gap-3 text-sm"
                                >
                                    <Link
                                        href={`/orders/${order.id}`}
                                        className="truncate text-primary hover:underline"
                                    >
                                        {order.orderNumber}
                                    </Link>
                                    <div className="truncate">
                                        <p className="font-medium truncate">{order.customerName}</p>
                                        {order.customerEmail && (
                                            <p className="text-xs text-gray-500 truncate">
                                                {order.customerEmail}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {formatDate(order.createdAt)}
                                    </span>
                                    <span className="text-right">
                                        ₹{order.totalAmount.toLocaleString('en-IN', {
                                            maximumFractionDigits: 0,
                                        })}
                                    </span>
                                    <span className="text-right">
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                            {order.status}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

