/**
 * Refund Modal Component
 * Handles payment refund operations
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select } from '@/app/components/ui/select';
import { processPaymentRefund, type Payment, type RefundData } from '@/lib/api/payments.service';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { formatCurrency } from '@/lib/utils/format';

interface RefundModalProps {
    payment: Payment;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function RefundModal({ payment, isOpen, onClose, onSuccess }: RefundModalProps) {
    const [amount, setAmount] = useState<string>('');
    const [reason, setReason] = useState('');
    const [method, setMethod] = useState<'AUTOMATIC' | 'MANUAL'>('AUTOMATIC');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!reason.trim()) {
            toastError('Please provide a reason for the refund');
            return;
        }

        const refundAmount = amount ? parseFloat(amount) : undefined;
        
        if (refundAmount !== undefined) {
            if (refundAmount <= 0) {
                toastError('Refund amount must be greater than 0');
                return;
            }
            if (refundAmount > payment.amount) {
                toastError('Refund amount cannot exceed payment amount');
                return;
            }
        }

        try {
            setIsProcessing(true);
            const refundData: RefundData = {
                amount: refundAmount,
                reason: reason.trim(),
                method,
                notes: notes.trim() || undefined,
            };

            await processPaymentRefund(payment.id, refundData);
            toastSuccess('Refund processed successfully');
            onSuccess();
            handleClose();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to process refund');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setAmount('');
        setReason('');
        setMethod('AUTOMATIC');
        setNotes('');
        onClose();
    };

    const canRefund = payment.status === 'SUCCESS';

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogClose onClose={handleClose} />
                <DialogHeader>
                    <DialogTitle>Process Refund</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {!canRefund && (
                            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                                Only payments with SUCCESS status can be refunded. Current status: {payment.status}
                            </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Payment Amount</div>
                            <div className="text-lg font-semibold">{formatCurrency(payment.amount)}</div>
                        </div>

                        <div>
                            <Label htmlFor="amount">Refund Amount (Optional)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0"
                                max={payment.amount}
                                placeholder={`Leave empty for full refund (${formatCurrency(payment.amount)})`}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={isProcessing || !canRefund}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave empty to refund the full amount
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="reason">Reason *</Label>
                            <textarea
                                id="reason"
                                className="flex min-h-[80px] w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Enter reason for refund..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={isProcessing || !canRefund}
                                required
                                rows={3}
                            />
                        </div>

                        <div>
                            <Label htmlFor="method">Refund Method</Label>
                            <Select
                                id="method"
                                value={method}
                                onChange={(e) => setMethod(e.target.value as 'AUTOMATIC' | 'MANUAL')}
                                disabled={isProcessing || !canRefund}
                            >
                                <option value="AUTOMATIC">Automatic (via Razorpay)</option>
                                <option value="MANUAL">Manual</option>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="notes">Admin Notes (Optional)</Label>
                            <textarea
                                id="notes"
                                className="flex min-h-[60px] w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-foreground-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Add any additional notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isProcessing || !canRefund}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isProcessing || !canRefund}>
                            {isProcessing ? 'Processing...' : 'Process Refund'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
