/**
 * Payments List Component
 * Displays table of payment transactions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { getPayments, type Payment } from '@/lib/api/payments.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Eye } from 'lucide-react';
import Link from 'next/link';

function getStatusVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
    switch (status) {
        case 'SUCCESS':
            return 'success';
        case 'PENDING':
            return 'warning';
        case 'FAILED':
            return 'destructive';
        case 'REFUNDED':
            return 'secondary';
        default:
            return 'default';
    }
}

export function PaymentsList() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPayments();
    }, []);

    const loadPayments = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getPayments();
            setPayments(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load payments');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error) {
        return (
            <Alert variant="error">
                {error}
                <Button onClick={loadPayments} variant="outline" className="ml-4">
                    Retry
                </Button>
            </Alert>
        );
    }

    if (payments.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-gray-600">No payments found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Payment ID</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell className="font-mono text-sm">
                                    {payment.id.slice(0, 8)}...
                                </TableCell>
                                <TableCell>
                                    {payment.user?.name || payment.user?.email || payment.userId.slice(0, 8)}
                                </TableCell>
                                <TableCell>{formatCurrency(payment.amount)}</TableCell>
                                <TableCell>{payment.method}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(payment.status)}>
                                        {payment.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatDate(payment.createdAt)}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/dashboard/payments/${payment.id}`}>
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

