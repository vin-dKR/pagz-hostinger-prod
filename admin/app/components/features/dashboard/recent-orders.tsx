/**
 * Recent Orders Component
 * Displays list of recent orders with approve functionality
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { updateOrderStatus } from '@/lib/api/orders.service';
import { toastSuccess, toastError } from '@/lib/utils/toast';

interface RecentOrdersProps {
    recentOrders: DashboardOverviewResponse['recentOrders'];
    loading?: boolean;
    error?: string;
    onOrderUpdate?: () => void;
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString();
}

function getStatusBadgeColor(status: string) {
    const statusColors: Record<string, string> = {
        PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
        ACCEPTED: 'bg-blue-100 text-blue-800',
        PROCESSING: 'bg-purple-100 text-purple-800',
        SHIPPED: 'bg-indigo-100 text-indigo-800',
        DELIVERED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-red-100 text-red-800',
        REJECTED: 'bg-gray-100 text-gray-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
}

export function RecentOrders({ recentOrders, loading, error, onOrderUpdate }: RecentOrdersProps) {
    const router = useRouter();
    const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

    const handleApprove = async (orderId: string) => {
        try {
            setApprovingOrderId(orderId);
            await updateOrderStatus(orderId, { status: 'ACCEPTED' });
            toastSuccess('Order approved successfully');
            // Refresh the page data
            router.refresh();
            onOrderUpdate?.();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to approve order');
        } finally {
            setApprovingOrderId(null);
        }
    };

    return (
        <Card className="shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-semibold">Latest Orders</CardTitle>
                    <Link
                        href="/orders"
                        className="text-sm text-primary hover:underline flex items-center gap-1 transition-colors"
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
                                className="h-16 animate-pulse rounded-md bg-gray-100"
                            />
                        ))}
                    </div>
                ) : recentOrders.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No orders yet
                    </p>
                ) : (
                    <div className="space-y-3">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide grid grid-cols-6 gap-3 pb-2 border-b">
                            <span>Order #</span>
                            <span>Customer</span>
                            <span>Date</span>
                            <span className="text-right">Total</span>
                            <span className="text-center">Status</span>
                            <span className="text-center">Action</span>
                        </div>
                        <div className="space-y-2">
                            {recentOrders.slice(0, 6).map((order) => (
                                <div
                                    key={order.id}
                                    className="grid grid-cols-6 items-center gap-3 text-sm p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                                >
                                    <Link
                                        href={`/orders/${order.id}`}
                                        className="truncate text-primary hover:underline font-medium"
                                    >
                                        {order.orderNumber}
                                    </Link>
                                    <div className="truncate">
                                        <p className="font-medium truncate text-gray-900">{order.customerName}</p>
                                        {order.customerEmail && (
                                            <p className="text-xs text-gray-500 truncate">
                                                {order.customerEmail}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-600">
                                        {formatDate(order.createdAt)}
                                    </span>
                                    <span className="text-right font-semibold text-gray-900">
                                        ₹{order.totalAmount.toLocaleString('en-IN', {
                                            maximumFractionDigits: 0,
                                        })}
                                    </span>
                                    <span className="text-center">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </span>
                                    <div className="text-center">
                                        {order.status === 'PENDING_REVIEW' ? (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                onClick={() => handleApprove(order.id)}
                                                disabled={approvingOrderId === order.id}
                                                className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                                                title="Approve Order"
                                            >
                                                {approvingOrderId === order.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                                                ) : (
                                                    <Check className="h-4 w-4 text-white" />
                                                )}
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-gray-400">—</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

