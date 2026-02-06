/**
 * Bulk Actions Component
 * Handles bulk operations on selected orders
 */

'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select } from '@/app/components/ui/select';
import { Download, FileText, RefreshCw, Trash2, X } from 'lucide-react';
import { type Order, type OrderStatus, updateOrderStatus, getOrderInvoice } from '@/lib/api/orders.service';
import { toastError, toastSuccess, toastPromise } from '@/lib/utils/toast';

interface BulkActionsProps {
    selectedOrders: Set<string>;
    orders: Order[];
    onDeselectAll: () => void;
    onUpdate: () => void;
}

export function BulkActions({ selectedOrders, orders, onDeselectAll, onUpdate }: BulkActionsProps) {
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<OrderStatus>('PROCESSING');
    const [comment, setComment] = useState('');

    const selectedCount = selectedOrders.size;
    const selectedOrdersList = orders.filter(order => selectedOrders.has(order.id));

    const handleBulkStatusUpdate = async () => {
        if (selectedCount === 0) return;

        try {
            setIsProcessing(true);
            const updates = Array.from(selectedOrders).map(orderId =>
                updateOrderStatus(orderId, {
                    status,
                    comment: comment || `Bulk status update to ${status}`
                })
            );

            await Promise.all(updates);
            setStatusModalOpen(false);
            setComment('');
            onUpdate();
            onDeselectAll();
            toastSuccess(`Updated ${selectedCount} order(s) successfully`);
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to update orders');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkExport = () => {
        const csvData = convertToCSV(selectedOrdersList);
        downloadCSV(csvData, `orders-export-${new Date().toISOString().split('T')[0]}.csv`);
        onDeselectAll();
    };

    const handleBulkPrintInvoices = async () => {
        try {
            setIsProcessing(true);
            for (const orderId of selectedOrders) {
                try {
                    const invoiceHtml = await getOrderInvoice(orderId);
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                        printWindow.document.write(invoiceHtml);
                        printWindow.document.close();
                        // Small delay between prints to avoid browser blocking
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (err) {
                    console.error(`Failed to print invoice for order ${orderId}:`, err);
                }
            }
            onDeselectAll();
            toastSuccess(`Printed ${selectedCount} invoice(s)`);
        } catch (err) {
            toastError('Some invoices failed to print. Check console for details.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="sticky top-0 z-10 bg-white border-b p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                            {selectedCount} order{selectedCount !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDeselectAll}
                            className="h-6 px-2"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusModalOpen(true)}
                        disabled={isProcessing}
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Update Status
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkExport}
                        disabled={isProcessing}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkPrintInvoices}
                        disabled={isProcessing}
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        Print Invoices
                    </Button>
                </div>
            </div>

            {/* Bulk Status Update Modal */}
            <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setStatusModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Bulk Update Status</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>New Status</Label>
                            <Select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                            >
                                <option value="PENDING_REVIEW">Pending Review</option>
                                <option value="ACCEPTED">Accepted</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="PROCESSING">Processing</option>
                                <option value="SHIPPED">Shipped</option>
                                <option value="DELIVERED">Delivered</option>
                                <option value="CANCELLED">Cancelled</option>
                            </Select>
                        </div>
                        <div>
                            <Label>Comment (Optional)</Label>
                            <Input
                                type="text"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add a note for this status change"
                            />
                        </div>
                        <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                            This will update {selectedCount} order{selectedCount !== 1 ? 's' : ''} to "{status.replace(/_/g, ' ')}"
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleBulkStatusUpdate} disabled={isProcessing}>
                            {isProcessing ? 'Updating...' : 'Update All'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function convertToCSV(orders: Order[]): string {
    const headers = [
        'Order ID',
        'Date',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Items Count',
        'Subtotal',
        'Discount',
        'Shipping',
        'Total',
        'Status',
        'Payment Status',
        'Payment Method',
        'City',
        'State',
        'Country',
    ];

    const rows = orders.map(order => {
        const address = order.address || order.shippingAddress;
        return [
            order.id,
            new Date(order.createdAt).toLocaleDateString(),
            order.user?.name || '',
            order.user?.email || '',
            order.user?.phone || '',
            order.items.length.toString(),
            (order.subtotal || 0).toString(),
            (order.discountAmount || 0).toString(),
            (order.shippingCharges || 0).toString(),
            order.total.toString(),
            order.status,
            order.paymentStatus,
            order.paymentMethod,
            address?.city || '',
            address?.state || '',
            address?.country || '',
        ];
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
}

function downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

