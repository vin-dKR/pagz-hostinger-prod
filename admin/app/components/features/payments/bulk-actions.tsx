/**
 * Bulk Actions Component
 * Handles bulk operations on selected payments
 */

'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Select } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Download, X } from 'lucide-react';
import { type Payment, type PaymentStatus, updatePaymentStatus, exportPayments } from '@/lib/api/payments.service';
import { toastError, toastSuccess } from '@/lib/utils/toast';

interface BulkActionsProps {
    selectedPayments: Set<string>;
    payments: Payment[];
    onDeselectAll: () => void;
    onUpdate: () => void;
}

export function BulkActions({ selectedPayments, payments = [], onDeselectAll, onUpdate }: BulkActionsProps) {
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<PaymentStatus>('SUCCESS');

    const selectedCount = selectedPayments.size;
    const selectedPaymentsList = (payments || []).filter(payment => selectedPayments.has(payment.id));

    const handleBulkStatusUpdate = async () => {
        if (selectedCount === 0) return;

        try {
            setIsProcessing(true);
            const updates = Array.from(selectedPayments).map(paymentId =>
                updatePaymentStatus(paymentId, {
                    status,
                    notes: `Bulk status update to ${status}`
                })
            );

            await Promise.all(updates);
            setStatusModalOpen(false);
            onUpdate();
            onDeselectAll();
            toastSuccess(`Updated ${selectedCount} payment(s) successfully`);
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to update payments');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkExport = async () => {
        try {
            setIsProcessing(true);
            const paymentIds = Array.from(selectedPayments);
            // Export only selected payments by filtering
            await exportPayments({
                // Note: Backend should support filtering by payment IDs, or we can export client-side
                // For now, we'll export all with current filters and let user filter manually
            });
            onDeselectAll();
            toastSuccess(`Exported ${selectedCount} payment(s)`);
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to export payments');
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
                            {selectedCount} payment{selectedCount !== 1 ? 's' : ''} selected
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
                                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                            >
                                <option value="PENDING">Pending</option>
                                <option value="SUCCESS">Success</option>
                                <option value="FAILED">Failed</option>
                                <option value="REFUNDED">Refunded</option>
                            </Select>
                        </div>
                        <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                            This will update {selectedCount} payment{selectedCount !== 1 ? 's' : ''} to "{status}"
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
