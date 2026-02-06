/**
 * Orders List Component
 * Displays table of orders with status management, filters, and statistics
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
import {
    getOrders,
    exportOrders,
    type Order,
    type PaginatedResponse,
    type OrderQueryParams,
} from '@/lib/api/orders.service';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import Link from 'next/link';
import { Eye, Search, Image as ImageIcon, Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toastError, toastSuccess, toastPromise } from '@/lib/utils/toast';
import { Input } from '@/app/components/ui/input';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { OrderStats } from './order-stats';
import { OrderFilters } from './order-filters';
import { OrderStatusBadge, PaymentStatusBadge } from './status-badge';
import { BulkActions } from './bulk-actions';

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<OrderQueryParams>({});
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadOrders(page, debouncedSearch, filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, filters]);

    const loadOrders = async (pageParam = 1, searchParam = '', filterParams: OrderQueryParams = {}) => {
        try {
            setIsLoading(true);
            setError(null);
            const data: PaginatedResponse<Order> = await getOrders({
                page: pageParam,
                limit: 20,
                search: searchParam || undefined,
                ...filterParams,
            });
            setOrders(data.items);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
            setHasLoadedOnce(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load orders');
        } finally {
            setIsLoading(false);
        }
    };

    // Reset to page 1 when search or filters change
    useEffect(() => {
        if (hasLoadedOnce) {
            setPage(1);
            setSelectedOrders(new Set()); // Clear selection when filters change
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, filters]);

    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrders(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedOrders.size === orders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(orders.map(order => order.id)));
        }
    };

    const deselectAll = () => {
        setSelectedOrders(new Set());
    };

    const handleBulkUpdate = () => {
        loadOrders(page, debouncedSearch, filters);
    };

    const handleExportAll = async () => {
        try {
            await exportOrders({
                ...filters,
                format: 'csv',
            });
            toastSuccess('Orders exported successfully');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to export orders');
        }
    };

    if (isLoading && !hasLoadedOnce) {
        return <PageLoading />;
    }

    return (
        <div className="space-y-6">
            {/* Statistics Dashboard */}
            <OrderStats />

            <Card>
                <CardContent className="p-0">
                    {/* Bulk Actions Bar */}
                    <BulkActions
                        selectedOrders={selectedOrders}
                        orders={orders}
                        onDeselectAll={deselectAll}
                        onUpdate={handleBulkUpdate}
                    />

                    {/* Search and Filters */}
                    <div className="border-b bg-gray-50/50 p-4">
                        <div className="flex items-center justify-between gap-4 flex-nowrap">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {/* Filters */}
                                <OrderFilters filters={filters} onFiltersChange={setFilters} />
                                <div className="relative flex-1 max-w-md min-w-0">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search orders by ID, customer email, name, phone, product..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                                <div className="text-sm text-[var(--color-foreground-secondary)] whitespace-nowrap">
                                    {total > 0 ? (
                                        <>
                                            <span className="font-medium">{total}</span> result{total !== 1 ? 's' : ''} • Page{' '}
                                            <span className="font-medium">{page}</span> of{' '}
                                            <span className="font-medium">{totalPages || 1}</span>
                                        </>
                                    ) : (
                                        'No results'
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExportAll}
                                        disabled={isLoading}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Export All
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                                        disabled={page >= totalPages || isLoading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>


                    </div>

                    {/* Inline error, keeps search visible */}
                    {error && (
                        <div className="px-4 pb-2 pt-4">
                            <Alert variant="error">
                                {error}
                                <Button
                                    onClick={() => loadOrders(page, debouncedSearch)}
                                    variant="outline"
                                    size="sm"
                                    className="ml-4"
                                >
                                    Retry
                                </Button>
                            </Alert>
                        </div>
                    )}

                    {/* Table / empty state */}
                    <div className="relative">
                        {isLoading && hasLoadedOnce && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                <div className="rounded-lg bg-white/90 px-4 py-2 text-sm text-gray-600 shadow-sm">
                                    Updating results...
                                </div>
                            </div>
                        )}

                        {orders.length === 0 && !isLoading && !error ? (
                            <div className="px-4 pb-6 pt-4">
                                <Card>
                                    <CardContent className="py-8 text-center">
                                        <p className="text-gray-600">
                                            No orders found. Try adjusting your search or filters.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                checked={orders.length > 0 && selectedOrders.size === orders.length}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300"
                                            />
                                        </TableHead>
                                        <TableHead>Order ID</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Payment</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => {
                                        const isSelected = selectedOrders.has(order.id);
                                        const firstItem = order.items[0];
                                        const firstImage = firstItem?.product?.images?.[0];

                                        return (
                                            <TableRow key={order.id} className={isSelected ? 'bg-blue-50' : ''}>
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleOrderSelection(order.id)}
                                                        className="rounded border-gray-300"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {firstImage?.url && (
                                                            <div className="relative w-10 h-10 rounded border overflow-hidden bg-gray-100">
                                                                <img
                                                                    src={firstImage.url}
                                                                    alt={firstItem?.product?.name || 'Product'}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-medium">{order.id.slice(0, 8)}...</div>
                                                            <div className="text-xs text-gray-500">
                                                                {formatDateTime(order.createdAt)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">
                                                            {order.user?.name || 'N/A'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {order.user?.email}
                                                        </div>
                                                        {order.user?.phone && (
                                                            <div className="text-xs text-gray-400">
                                                                {order.user.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{order.items.length} item(s)</div>
                                                        <div className="text-xs text-gray-500 max-w-[200px] truncate">
                                                            {firstItem?.product?.name || 'Product'}
                                                            {order.items.length > 1 && ` +${order.items.length - 1} more`}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold">{formatCurrency(order.total)}</div>
                                                    {order.discountAmount && order.discountAmount > 0 && (
                                                        <div className="text-xs text-green-600">
                                                            -{formatCurrency(order.discountAmount)} discount
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <OrderStatusBadge status={order.status} />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <PaymentStatusBadge status={order.paymentStatus} />
                                                        <div className="text-xs text-gray-500">
                                                            {order.paymentMethod}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        <div>{formatDate(order.createdAt)}</div>
                                                        {order.updatedAt !== order.createdAt && (
                                                            <div className="text-xs text-gray-400">
                                                                Updated: {formatDate(order.updatedAt)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/orders/${order.id}`}>
                                                        <Button variant="ghost" size="icon" title="View Details">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

