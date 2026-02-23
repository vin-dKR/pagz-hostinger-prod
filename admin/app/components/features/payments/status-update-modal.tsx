/**
 * Status Update Modal Component
 * Handles payment status update operations
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select } from '@/app/components/ui/select';
import { Input } from '@/app/components/ui/input';
import { updatePaymentStatus, type Payment, type PaymentStatus } from '@/lib/api/payments.service';
import { toastError, toastSuccess } from '@/lib/utils/toast';

interface StatusUpdateModalProps {
    payment: Payment;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function StatusUpdateModal({ payment, isOpen, onClose, onSuccess }: StatusUpdateModalProps) {
    const [status, setStatus] = useState<PaymentStatus>(payment.status);
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (status === payment.status) {
            toastError('Please select a different status');
            return;
        }

        try {
            setIsProcessing(true);
            await updatePaymentStatus(payment.id, {
                status,
                notes: notes.trim() || undefined,
            });
            toastSuccess('Payment status updated successfully');
            onSuccess();
            handleClose();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to update payment status');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setStatus(payment.status);
        setNotes('');
        onClose();
    };

    const statusOptions: PaymentStatus[] = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogClose onClose={handleClose} />
                <DialogHeader>
                    <DialogTitle>Update Payment Status</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Current Status</div>
                            <div className="text-lg font-semibold">{payment.status}</div>
                        </div>

                        <div>
                            <Label htmlFor="status">New Status *</Label>
                            <Select
                                id="status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                                disabled={isProcessing}
                            >
                                {statusOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="notes">Admin Notes (Optional)</Label>
                            <Input
                                id="notes"
                                type="text"
                                placeholder="Add a note for this status change..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isProcessing}
                            />
                        </div>

                        {status === 'REFUNDED' && payment.status !== 'REFUNDED' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                                Note: Changing status to REFUNDED will not process an actual refund. Use the Refund button to process a refund.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isProcessing || status === payment.status}>
                            {isProcessing ? 'Updating...' : 'Update Status'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
