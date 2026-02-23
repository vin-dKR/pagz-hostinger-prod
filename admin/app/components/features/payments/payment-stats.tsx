/**
 * Payment Statistics Dashboard Component
 * Displays payment statistics at the top of the payments page
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Spinner } from '@/app/components/ui/loading';
import { getPaymentStatistics, type PaymentStatistics } from '@/lib/api/payments.service';
import { formatCurrency } from '@/lib/utils/format';
import { AlertCircle, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

export function PaymentStats() {
    const [stats, setStats] = useState<PaymentStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getPaymentStatistics();
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
                                <p className="text-sm font-medium text-gray-600">Total Payments</p>
                                <p className="text-3xl font-bold mt-2">{stats.totalPayments}</p>
                                <p className="text-xs text-gray-500 mt-2">All time</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                                <p className="text-3xl font-bold mt-2">{formatCurrency(stats.totalAmount)}</p>
                                <p className="text-xs text-gray-500 mt-2">All transactions</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Successful</p>
                                <p className="text-3xl font-bold mt-2 text-green-600">{stats.successfulPayments}</p>
                                <p className="text-xs text-gray-500 mt-2">{formatCurrency(stats.successfulAmount)}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
                                <p className="text-3xl font-bold mt-2">{formatCurrency(stats.averageTransactionValue)}</p>
                                <p className="text-xs text-gray-500 mt-2">Per payment</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Pending</p>
                                <p className="text-2xl font-bold mt-2 text-yellow-600">{stats.pendingPayments}</p>
                                <p className="text-xs text-gray-500 mt-2">{formatCurrency(stats.pendingAmount)}</p>
                            </div>
                            <Clock className="h-6 w-6 text-yellow-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Failed</p>
                                <p className="text-2xl font-bold mt-2 text-red-600">{stats.failedPayments}</p>
                                <p className="text-xs text-gray-500 mt-2">{formatCurrency(stats.failedAmount)}</p>
                            </div>
                            <XCircle className="h-6 w-6 text-red-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Refunded</p>
                                <p className="text-2xl font-bold mt-2 text-gray-600">{stats.refundedPayments}</p>
                                <p className="text-xs text-gray-500 mt-2">{formatCurrency(stats.refundedAmount)}</p>
                            </div>
                            <RotateCcw className="h-6 w-6 text-gray-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                                <p className="text-2xl font-bold mt-2">
                                    {stats.totalPayments > 0
                                        ? `${((stats.successfulPayments / stats.totalPayments) * 100).toFixed(1)}%`
                                        : '0%'}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Of total payments</p>
                            </div>
                            <AlertCircle className="h-6 w-6 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payments by Status */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Payments by Status</h3>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(stats.byStatus).map(([status, data]) => (
                            <Badge
                                key={status}
                                variant="secondary"
                                className="px-4 py-2 text-sm"
                            >
                                <span className="capitalize">{status.toLowerCase()}</span>
                                <span className="ml-2 font-bold">{data.count}</span>
                                <span className="ml-2 text-xs">({formatCurrency(data.amount)})</span>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Payments by Method */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Payments by Method</h3>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(stats.byMethod).map(([method, data]) => (
                            <Badge
                                key={method}
                                variant="outline"
                                className="px-4 py-2 text-sm"
                            >
                                <span className="capitalize">{method.toLowerCase()}</span>
                                <span className="ml-2 font-bold">{data.count}</span>
                                <span className="ml-2 text-xs">({formatCurrency(data.amount)})</span>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
