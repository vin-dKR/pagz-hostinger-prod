/**
 * Payment Detail Component
 * Comprehensive payment detail page with tabs and all sections
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Alert } from '@/app/components/ui/alert';
import { PageLoading } from '@/app/components/ui/loading';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import {
    getPayment,
    type Payment,
} from '@/lib/api/payments.service';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { PaymentStatusBadge } from './status-badge';
import { PaymentMethodBadge } from './method-badge';
import { RefundModal } from './refund-modal';
import { StatusUpdateModal } from './status-update-modal';
import {
    ArrowLeft,
    Copy,
    Download,
    RotateCcw,
    RefreshCw,
    CreditCard,
    User,
    Package,
    Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/utils/toast';

export function PaymentDetail({ paymentId, initialPayment }: { paymentId: string; initialPayment?: Payment }) {
    const router = useRouter();
    const [payment, setPayment] = useState<Payment | null>(initialPayment || null);
    const [isLoading, setIsLoading] = useState(!initialPayment);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [statusModalOpen, setStatusModalOpen] = useState(false);

    useEffect(() => {
        if (!initialPayment) {
            loadPayment();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentId, initialPayment]);

    const loadPayment = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getPayment(paymentId);
            setPayment(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load payment');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = () => {
        loadPayment();
    };

    const copyPaymentId = () => {
        navigator.clipboard.writeText(paymentId);
        toastSuccess('Payment ID copied to clipboard');
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error || !payment) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <Alert variant="error">{error || 'Payment not found'}</Alert>
            </div>
        );
    }

    const canRefund = payment.status === 'SUCCESS';

    return (
        <div className="space-y-8 max-w-[1600px]">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="flex-shrink-0"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">
                                Payment Details
                            </h1>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyPaymentId}
                                className="flex items-center gap-1"
                            >
                                <Copy className="h-4 w-4" />
                                Copy ID
                            </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-foreground-secondary)] font-mono">
                            <span>{payment.id}</span>
                            <span>•</span>
                            <span>Created: {formatDateTime(payment.createdAt)}</span>
                            <span>•</span>
                            <span>Updated: {formatDateTime(payment.updatedAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <PaymentStatusBadge status={payment.status} />
                    <PaymentMethodBadge method={payment.method} />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleRefresh}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                        {canRefund && (
                            <Button
                                variant="outline"
                                onClick={() => setRefundModalOpen(true)}
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Refund
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => setStatusModalOpen(true)}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Update Status
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transaction">Transaction Details</TabsTrigger>
                    <TabsTrigger value="order">Related Order</TabsTrigger>
                    <TabsTrigger value="refund">Refund History</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Payment Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Payment Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-gray-600">Payment ID</div>
                                        <div className="font-mono text-sm font-semibold">{payment.id}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Status</div>
                                        <div>
                                            <PaymentStatusBadge status={payment.status} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Method</div>
                                        <div>
                                            <PaymentMethodBadge method={payment.method} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Amount</div>
                                        <div className="text-lg font-semibold">{formatCurrency(payment.amount)}</div>
                                    </div>
                                    {payment.discountAmount && payment.discountAmount > 0 && (
                                        <>
                                            <div>
                                                <div className="text-sm text-gray-600">Discount</div>
                                                <div className="text-green-600 font-semibold">
                                                    -{formatCurrency(payment.discountAmount)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-600">Final Amount</div>
                                                <div className="text-lg font-semibold">
                                                    {formatCurrency(payment.amount - payment.discountAmount)}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="pt-4 border-t">
                                    <div className="text-sm text-gray-600 mb-2">Dates</div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span>Created:</span>
                                            <span>{formatDateTime(payment.createdAt)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Updated:</span>
                                            <span>{formatDateTime(payment.updatedAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* User Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    User Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {payment.user ? (
                                    <>
                                        <div>
                                            <div className="text-sm text-gray-600">User ID</div>
                                            <div className="font-mono text-sm">
                                                <Link
                                                    href={`/users/${payment.user.id}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {payment.user.id}
                                                </Link>
                                            </div>
                                        </div>
                                        {payment.user.name && (
                                            <div>
                                                <div className="text-sm text-gray-600">Name</div>
                                                <div className="font-semibold">{payment.user.name}</div>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-sm text-gray-600">Email</div>
                                            <div>{payment.user.email}</div>
                                        </div>
                                        {payment.user.phone && (
                                            <div>
                                                <div className="text-sm text-gray-600">Phone</div>
                                                <div>{payment.user.phone}</div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-gray-500">
                                        <div className="font-mono text-sm">{payment.userId}</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Order Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Order Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {payment.order ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-gray-600">Order ID</div>
                                            <div className="font-mono text-sm">
                                                <Link
                                                    href={`/orders/${payment.order.id}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {payment.order.id}
                                                </Link>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Order Status</div>
                                            <div>{payment.order.status}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Order Total</div>
                                            <div className="font-semibold">{formatCurrency(payment.order.total)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Order Date</div>
                                            <div>{formatDateTime(payment.order.createdAt)}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500">
                                    <div className="font-mono text-sm">{payment.orderId}</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Coupon Information */}
                    {payment.coupon && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Coupon Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-gray-600">Coupon Code</div>
                                        <div className="font-semibold">{payment.coupon.code}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Coupon Name</div>
                                        <div>{payment.coupon.name}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Transaction Details Tab */}
                <TabsContent value="transaction" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {payment.phonePeOrderId || payment.phonePeTransactionId ? (
                                <div className="space-y-4">
                                    {payment.phonePeOrderId && (
                                        <div>
                                            <div className="text-sm text-gray-600">PhonePe Order ID</div>
                                            <div className="font-mono text-sm">{payment.phonePeOrderId}</div>
                                        </div>
                                    )}
                                    {payment.phonePeTransactionId && (
                                        <div>
                                            <div className="text-sm text-gray-600">PhonePe Transaction ID</div>
                                            <div className="font-mono text-sm">{payment.phonePeTransactionId}</div>
                                        </div>
                                    )}
                                    {payment.paymentInstrument && (
                                        <div>
                                            <div className="text-sm text-gray-600">Payment Method</div>
                                            <div className="font-medium text-sm">{payment.paymentInstrument}</div>
                                        </div>
                                    )}
                                    {payment.paymentDetails && (
                                        <div>
                                            <div className="text-sm text-gray-600">Payment Details</div>
                                            <div className="text-sm space-y-1 mt-1">
                                                {payment.paymentDetails.vpa && (
                                                    <div><span className="text-gray-500">UPI ID:</span> <span className="font-mono">{payment.paymentDetails.vpa}</span></div>
                                                )}
                                                {payment.paymentDetails.cardNetwork && (
                                                    <div><span className="text-gray-500">Card:</span> {payment.paymentDetails.cardNetwork}{payment.paymentDetails.last4 ? ` ****${payment.paymentDetails.last4}` : ''}</div>
                                                )}
                                                {payment.paymentDetails.cardType && (
                                                    <div><span className="text-gray-500">Type:</span> {payment.paymentDetails.cardType}</div>
                                                )}
                                                {payment.paymentDetails.bankName && (
                                                    <div><span className="text-gray-500">Bank:</span> {payment.paymentDetails.bankName}</div>
                                                )}
                                                {payment.paymentDetails.walletType && (
                                                    <div><span className="text-gray-500">Wallet:</span> {payment.paymentDetails.walletType}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-gray-500">No PhonePe transaction details available</div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Related Order Tab */}
                <TabsContent value="order" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Related Order</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {payment.order ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-gray-600">Order ID</div>
                                            <div className="font-mono text-lg">
                                                <Link
                                                    href={`/orders/${payment.order.id}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {payment.order.id}
                                                </Link>
                                            </div>
                                        </div>
                                        <Link href={`/orders/${payment.order.id}`}>
                                            <Button variant="outline">
                                                View Full Order
                                            </Button>
                                        </Link>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                        <div>
                                            <div className="text-sm text-gray-600">Status</div>
                                            <div>{payment.order.status}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Total</div>
                                            <div className="font-semibold">{formatCurrency(payment.order.total)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-600">Created</div>
                                            <div>{formatDateTime(payment.order.createdAt)}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500">
                                    <div className="font-mono text-sm">{payment.orderId}</div>
                                    <p className="mt-2">Order details not available</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Refund History Tab */}
                <TabsContent value="refund" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Refund History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {payment.status === 'REFUNDED' ? (
                                <div className="space-y-4">
                                    <div className="bg-gray-50 p-4 rounded">
                                        <div className="text-sm text-gray-600">Refund Status</div>
                                        <div className="text-lg font-semibold text-gray-700">Refunded</div>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        This payment has been refunded. Refund details are stored in the payment record.
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-8">
                                    No refund history available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <RefundModal
                payment={payment}
                isOpen={refundModalOpen}
                onClose={() => setRefundModalOpen(false)}
                onSuccess={handleRefresh}
            />

            <StatusUpdateModal
                payment={payment}
                isOpen={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                onSuccess={handleRefresh}
            />
        </div>
    );
}
