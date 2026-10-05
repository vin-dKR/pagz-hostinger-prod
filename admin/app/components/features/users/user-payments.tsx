/**
 * User Payments Tab Component
 * Displays user's payment history
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { PageLoading } from '@/app/components/ui/loading';
import { getUserPayments, type PaginatedResponse } from '@/lib/api/users.service';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserPaymentsProps {
    userId: string;
}

export function UserPayments({ userId }: UserPaymentsProps) {
    const router = useRouter();
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadPayments();
    }, [userId, page]);

    const loadPayments = async () => {
        try {
            setIsLoading(true);
            const data = await getUserPayments(userId, { page, limit: 20 });
            setPayments(data.items);
            setTotalPages(data.pagination.totalPages);
        } catch (error) {
            console.error('Failed to load payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            PENDING: { variant: 'secondary', label: 'Pending' },
            SUCCESS: { variant: 'default', label: 'Success' },
            FAILED: { variant: 'destructive', label: 'Failed' },
            REFUNDED: { variant: 'destructive', label: 'Refunded' },
        };
        const config = variants[status] || { variant: 'secondary', label: status };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const getMethodBadge = (method: string) => {
        return <Badge variant="outline">{method}</Badge>;
    };

    if (isLoading) {
        return <PageLoading />;
    }

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <div className="border-b border-[var(--color-border)] px-5 py-4"><h2 className="text-sm font-semibold text-[var(--color-foreground)]">Payment history</h2><p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">Transactions associated with this customer</p></div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Payment ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-12 text-center text-sm text-[var(--color-foreground-secondary)]">
                                        No payments found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell className="font-mono text-xs text-[var(--color-foreground-secondary)]">{payment.id.slice(0, 8)}...</TableCell>
                                        <TableCell>{formatDate(payment.createdAt)}</TableCell>
                                        <TableCell>
                                            {payment.order ? (
                                                <button
                                                    onClick={() => router.push(`/orders/${payment.order.id}`)}
                                                    className="font-mono text-xs text-[var(--color-primary)] hover:underline"
                                                >
                                                    {payment.order.id.slice(0, 8)}...
                                                </button>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell className="font-semibold tabular-nums">{formatCurrency(Number(payment.amount))}</TableCell>
                                        <TableCell>{getMethodBadge(payment.method)}</TableCell>
                                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                                        <TableCell className="text-right">
                                            {payment.order && (
                                                <button
                                                    onClick={() => router.push(`/orders/${payment.order.id}`)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-foreground-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)]"
                                                    aria-label={`View order ${payment.order.id}`}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
