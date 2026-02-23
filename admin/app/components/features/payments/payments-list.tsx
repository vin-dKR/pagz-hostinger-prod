/**
 * Payments List Component
 * Displays table of payment transactions with filters, pagination, and bulk actions
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
import { Spinner, PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
    getPayments,
    exportPayments,
    type Payment,
    type PaymentQueryParams,
} from '@/lib/api/payments.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { PaymentStats } from './payment-stats';
import { PaymentFilters } from './payment-filters';
import { PaymentStatusBadge } from './status-badge';
import { PaymentMethodBadge } from './method-badge';
import { BulkActions } from './bulk-actions';
import { Eye, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { formatPaymentId } from '@/lib/utils/payment-format';

export function PaymentsList() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<PaymentQueryParams>({});
    const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadPayments(page, debouncedSearch, filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, filters]);

    const loadPayments = async (pageParam = 1, searchParam = '', filterParams: PaymentQueryParams = {}) => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getPayments({
                page: pageParam,
                limit: 20,
                search: searchParam || undefined,
                ...filterParams,
            });
            setPayments(data.items || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotal(data.pagination?.total || 0);
            setHasLoadedOnce(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load payments');
        } finally {
            setIsLoading(false);
        }
    };

    // Reset to page 1 when search or filters change
    useEffect(() => {
        if (hasLoadedOnce) {
            setPage(1);
            setSelectedPayments(new Set()); // Clear selection when filters change
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, filters]);

    const togglePaymentSelection = (paymentId: string) => {
        const newSelection = new Set(selectedPayments);
        if (newSelection.has(paymentId)) {
            newSelection.delete(paymentId);
        } else {
            newSelection.add(paymentId);
        }
        setSelectedPayments(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedPayments.size === payments.length) {
            setSelectedPayments(new Set());
        } else {
            setSelectedPayments(new Set(payments.map(p => p.id)));
        }
    };

    const deselectAll = () => {
        setSelectedPayments(new Set());
    };

    const handleBulkUpdate = () => {
        loadPayments(page, debouncedSearch, filters);
    };

    const handleExport = async () => {
        try {
            await exportPayments({
                ...filters,
                search: debouncedSearch || undefined,
            });
            toastSuccess('Payments exported successfully');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to export payments');
        }
    };

    if (isLoading && !hasLoadedOnce) {
        return <PageLoading />;
    }

    return (
        <div className="space-y-6">
            {/* Statistics Dashboard */}
            <PaymentStats />

            <Card>
                <CardContent className="p-0">
                    {/* Bulk Actions Bar */}
                    <BulkActions
                        selectedPayments={selectedPayments}
                        payments={payments || []}
                        onDeselectAll={deselectAll}
                        onUpdate={handleBulkUpdate}
                    />

                    {/* Search and Filters */}
                    <div className="border-b bg-gray-50/50 p-4">
                        <div className="flex items-center justify-between gap-4 flex-nowrap">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* Filters */}
                                <PaymentFilters filters={filters} onFiltersChange={setFilters} />
                                <div className="relative flex-1 max-w-md min-w-0">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search payments by ID, razorpay IDs, user email/name..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={isLoading}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="p-4">
                            <Alert variant="error">
                                {error}
                                <Button onClick={() => loadPayments(page, debouncedSearch, filters)} variant="outline" className="ml-4">
                                    Retry
                                </Button>
                            </Alert>
                        </div>
                    )}

                    {/* Table */}
                    {!error && (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedPayments.size === payments.length && payments.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300"
                                            />
                                        </TableHead>
                                        <TableHead>Payment ID</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Order</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Discount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8">
                                                <Spinner size="sm" />
                                            </TableCell>
                                        </TableRow>
                                    ) : payments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-12">
                                                <p className="text-gray-600">No payments found.</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        payments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPayments.has(payment.id)}
                                                        onChange={() => togglePaymentSelection(payment.id)}
                                                        className="rounded border-gray-300"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-sm" title={payment.id}>
                                                    {formatPaymentId(payment.id)}
                                                </TableCell>
                                                <TableCell>
                                                    {payment.user ? (
                                                        <Link
                                                            href={`/users/${payment.user.id}`}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            {payment.user.name || payment.user.email}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-gray-500">{formatPaymentId(payment.userId)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {payment.order ? (
                                                        <Link
                                                            href={`/orders/${payment.order.id}`}
                                                            className="text-blue-600 hover:underline font-mono text-sm"
                                                        >
                                                            {formatPaymentId(payment.order.id)}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-gray-500 font-mono text-sm">{formatPaymentId(payment.orderId)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-semibold">
                                                    {formatCurrency(payment.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    {payment.discountAmount && payment.discountAmount > 0 ? (
                                                        <span className="text-green-600">-{formatCurrency(payment.discountAmount)}</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <PaymentMethodBadge method={payment.method} />
                                                </TableCell>
                                                <TableCell>
                                                    <PaymentStatusBadge status={payment.status} />
                                                </TableCell>
                                                <TableCell>{formatDate(payment.createdAt)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/payments/${payment.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!error && totalPages > 1 && (
                        <div className="border-t p-4 flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} payments
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || isLoading}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <div className="text-sm">
                                    Page {page} of {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || isLoading}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
