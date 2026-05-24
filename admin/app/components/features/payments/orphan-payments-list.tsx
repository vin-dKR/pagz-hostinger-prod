/**
 * Orphan Payments List
 *
 * Polls `/admin/payments/orphans` and renders each row with a Recover
 * button that opens a modal asking for `razorpayOrderId` +
 * `razorpayPaymentId` (admin copies these from Razorpay dashboard).
 * On submit, hits `/admin/payments/recover/:merchantOrderId` and shows
 * the resulting orderId so the admin can confirm + share with the
 * customer.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
    getOrphanPendingPayments,
    recoverStuckPayment,
    type OrphanPendingPayment,
} from '@/lib/api/payments.service';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { formatCurrency } from '@/lib/utils/format';
import { RefreshCw, AlertTriangle, Copy } from 'lucide-react';
import Link from 'next/link';

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

interface RecoverModalProps {
    orphan: OrphanPendingPayment | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function RecoverModal({ orphan, isOpen, onClose, onSuccess }: RecoverModalProps) {
    const [razorpayOrderId, setRazorpayOrderId] = useState('');
    const [razorpayPaymentId, setRazorpayPaymentId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ orderId: string; raced?: boolean; alreadyExisted?: boolean } | null>(null);

    useEffect(() => {
        if (isOpen) {
            setRazorpayOrderId('');
            setRazorpayPaymentId('');
            setResult(null);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orphan) return;
        if (!razorpayOrderId.trim() || !razorpayPaymentId.trim()) {
            toastError('Both razorpayOrderId and razorpayPaymentId are required.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await recoverStuckPayment(orphan.merchantOrderId, {
                razorpayOrderId: razorpayOrderId.trim(),
                razorpayPaymentId: razorpayPaymentId.trim(),
            });
            setResult(res);
            toastSuccess(
                res.alreadyExisted
                    ? 'Order already existed — no action needed.'
                    : res.raced
                        ? 'Order persisted (race with webhook).'
                        : 'Order recovered successfully.',
            );
            onSuccess();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Recovery failed';
            toastError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!orphan) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Recover orphan payment</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                    <div className="rounded border border-[var(--color-border)] p-3 bg-[var(--color-background-secondary)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Merchant Order ID</span>
                            <button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard?.writeText(orphan.merchantOrderId);
                                    toastSuccess('Copied');
                                }}
                                className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                            >
                                <Copy size={12} /> Copy
                            </button>
                        </div>
                        <div className="mt-1 font-mono text-xs break-all">{orphan.merchantOrderId}</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-[var(--color-foreground-secondary)]">Amount:</span>{' '}
                                <span className="font-medium">{formatCurrency(orphan.amount)}</span>
                            </div>
                            <div>
                                <span className="text-[var(--color-foreground-secondary)]">Items:</span>{' '}
                                <span className="font-medium">{orphan.itemCount}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-[var(--color-foreground-secondary)]">Created:</span>{' '}
                                <span className="font-medium">{formatDate(orphan.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {result ? (
                        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">
                            <div className="font-medium text-emerald-800">
                                {result.alreadyExisted
                                    ? 'Order already existed'
                                    : result.raced
                                        ? 'Order persisted (race with webhook)'
                                        : 'Order recovered'}
                            </div>
                            <div className="mt-1 font-mono text-xs text-emerald-900 break-all">
                                Order ID: {result.orderId}
                            </div>
                            <Link
                                href={`/orders/${result.orderId}`}
                                className="mt-2 inline-block text-xs text-emerald-700 underline"
                            >
                                Open order →
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <p className="text-xs text-[var(--color-foreground-secondary)]">
                                Open Razorpay Dashboard → Payments → find this transaction →
                                copy the two gateway ids below.
                            </p>

                            <div>
                                <Label htmlFor="razorpayOrderId">Razorpay Order ID</Label>
                                <Input
                                    id="razorpayOrderId"
                                    value={razorpayOrderId}
                                    onChange={(e) => setRazorpayOrderId(e.target.value)}
                                    placeholder="order_StHBRBSXaHexmA"
                                    disabled={submitting}
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="razorpayPaymentId">Razorpay Payment ID</Label>
                                <Input
                                    id="razorpayPaymentId"
                                    value={razorpayPaymentId}
                                    onChange={(e) => setRazorpayPaymentId(e.target.value)}
                                    placeholder="pay_StHBkw9OXb3ODW"
                                    disabled={submitting}
                                    required
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={submitting}
                                    onClick={onClose}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? 'Recovering…' : 'Recover order'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function OrphanPaymentsList() {
    const [orphans, setOrphans] = useState<OrphanPendingPayment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<OrphanPendingPayment | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getOrphanPendingPayments();
            setOrphans(res.orphans);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load orphan payments';
            setError(msg);
            toastError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle
                        size={16}
                        className={orphans.length > 0 ? 'text-amber-600' : 'text-emerald-600'}
                    />
                    <span className="font-medium">
                        {loading
                            ? 'Loading…'
                            : `${orphans.length} orphan payment${orphans.length === 1 ? '' : 's'} in the last 30 days`}
                    </span>
                </div>
                <Button onClick={() => void refresh()} disabled={loading} variant="outline" size="sm">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                </div>
            )}

            {!loading && orphans.length === 0 && !error && (
                <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-4 text-sm text-emerald-800">
                    No orphan payments. Every captured Razorpay payment has a matching order.
                </div>
            )}

            {orphans.length > 0 && (
                <div className="overflow-hidden rounded border border-[var(--color-border)]">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--color-background-secondary)] text-left text-xs uppercase tracking-wide text-[var(--color-foreground-secondary)]">
                            <tr>
                                <th className="px-3 py-2">Merchant Order ID</th>
                                <th className="px-3 py-2">Amount</th>
                                <th className="px-3 py-2">Items</th>
                                <th className="px-3 py-2">User</th>
                                <th className="px-3 py-2">Created</th>
                                <th className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {orphans.map((o) => (
                                <tr key={o.merchantOrderId} className="border-t border-[var(--color-border)]">
                                    <td className="px-3 py-2 font-mono text-xs">{o.merchantOrderId}</td>
                                    <td className="px-3 py-2 font-medium">{formatCurrency(o.amount)}</td>
                                    <td className="px-3 py-2">{o.itemCount}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{o.userId.slice(0, 8)}…</td>
                                    <td className="px-3 py-2 text-xs">{formatDate(o.createdAt)}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSelected(o);
                                                setModalOpen(true);
                                            }}
                                        >
                                            Recover
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <RecoverModal
                orphan={selected}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => void refresh()}
            />
        </div>
    );
}
