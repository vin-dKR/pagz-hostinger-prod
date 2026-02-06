/**
 * User Orders Tab Component
 * Displays user's order history
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { PageLoading } from '@/app/components/ui/loading';
import { getUserOrders, type PaginatedResponse } from '@/lib/api/users.service';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserOrdersProps {
    userId: string;
}

export function UserOrders({ userId }: UserOrdersProps) {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadOrders();
    }, [userId, page]);

    const loadOrders = async () => {
        try {
            setIsLoading(true);
            const data = await getUserOrders(userId, { page, limit: 20 });
            setOrders(data.items);
            setTotalPages(data.pagination.totalPages);
        } catch (error) {
            console.error('Failed to load orders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            PENDING_REVIEW: { variant: 'secondary', label: 'Pending Review' },
            ACCEPTED: { variant: 'default', label: 'Accepted' },
            REJECTED: { variant: 'destructive', label: 'Rejected' },
            PROCESSING: { variant: 'default', label: 'Processing' },
            SHIPPED: { variant: 'default', label: 'Shipped' },
            DELIVERED: { variant: 'default', label: 'Delivered' },
            CANCELLED: { variant: 'destructive', label: 'Cancelled' },
        };
        const config = variants[status] || { variant: 'secondary', label: status };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (isLoading) {
        return <PageLoading />;
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        No orders found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-sm">{order.id.slice(0, 8)}...</TableCell>
                                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                                        <TableCell>{order.items.length} item(s)</TableCell>
                                        <TableCell>{formatCurrency(Number(order.total))}</TableCell>
                                        <TableCell className="text-right">
                                            <button
                                                onClick={() => router.push(`/orders/${order.id}`)}
                                                className="text-blue-600 hover:underline"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
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

