/**
 * Order Detail Component
 * Comprehensive order detail page with tabs and all sections
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Alert } from '@/app/components/ui/alert';
import { PageLoading } from '@/app/components/ui/loading';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
    getOrder,
    updateOrderStatus,
    markAsShipped,
    markAsDelivered,
    markPaymentAsPaid,
    processRefund,
    type Order,
    type OrderStatus
} from '@/lib/api/orders.service';
import { downloadInvoicePDF, getInvoicePDFBlobUrl } from '@/lib/api/invoice.service';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { getPublicFileUrl, getFilenameFromPath } from '@/lib/utils/fileUrl';
import { OrderStatusBadge, PaymentStatusBadge } from './status-badge';
import {
    ArrowLeft,
    Copy,
    Download,
    Package,
    Truck,
    CreditCard,
    Clock,
    MapPin,
    User
} from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import Image from 'next/image';
import { imageLoader } from '@/lib/utils/image-loader';
import { TemplateDisplay } from './TemplateDisplay';
import { AdminFileTile } from './AdminFileTile';
import { AddonBreakdownRows } from './AddonBreakdownRows';
import { buildAddonLabelMap } from '@/lib/utils/addon-label';
const { getInvoicePDFUrl } = await import('@/lib/api/invoice.service');


export function OrderDetail({ orderId, initialOrder }: { orderId: string; initialOrder?: Order }) {
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(initialOrder || null);
    const [isLoading, setIsLoading] = useState(!initialOrder);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [shippingModalOpen, setShippingModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);

    useEffect(() => {
        if (!initialOrder) {
            loadOrder();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, initialOrder]);

    const loadOrder = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getOrder(orderId);
            setOrder(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load order');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (newStatus: OrderStatus, comment?: string) => {
        if (!order) return;
        try {
            await updateOrderStatus(orderId, { status: newStatus, comment });
            await loadOrder();
            setStatusModalOpen(false);
            toastSuccess('Order status updated successfully');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to update order status');
        }
    };

    const handleMarkAsShipped = async (trackingNumber: string, carrier?: string) => {
        if (!order) return;
        try {
            await markAsShipped(orderId, { trackingNumber, carrier });
            await loadOrder();
            setShippingModalOpen(false);
            toastSuccess('Order marked as shipped');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to mark as shipped');
        }
    };

    const handleMarkAsDelivered = async (notes?: string) => {
        if (!order) return;
        try {
            await markAsDelivered(orderId, { notes });
            await loadOrder();
            toastSuccess('Order marked as delivered');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to mark as delivered');
        }
    };

    const handleDownloadInvoice = async () => {
        setDownloadingInvoice(true);
        try {
            await downloadInvoicePDF(orderId);
            toastSuccess('Invoice downloaded successfully');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to download invoice');
        } finally {
            setDownloadingInvoice(false);
        }
    };

    const loadInvoicePDF = async () => {
        setLoadingInvoice(true);
        try {
            const blobUrl = await getInvoicePDFBlobUrl(orderId);
            setInvoicePdfUrl(blobUrl);
        } catch (err) {
            // Fallback: use direct URL with token (works if server supports token in query and allows iframe)
            try {
                const directUrl = getInvoicePDFUrl(orderId);
                setInvoicePdfUrl(directUrl);
            } catch (e) {
                toastError(err instanceof Error ? err.message : 'Failed to load invoice');
            }
        } finally {
            setLoadingInvoice(false);
        }
    };

    // Load invoice PDF when invoice tab is opened
    useEffect(() => {
        if (activeTab === 'invoice' && !invoicePdfUrl && !loadingInvoice) {
            setLoadingInvoice(true);
            loadInvoicePDF();
        }

        // Cleanup blob URL when component unmounts or tab changes
        return () => {
            if (invoicePdfUrl && activeTab !== 'invoice') {
                window.URL.revokeObjectURL(invoicePdfUrl);
                setInvoicePdfUrl(null);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const copyOrderId = () => {
        navigator.clipboard.writeText(orderId);
        toastSuccess('Order ID copied to clipboard');
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error || !order) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <Alert variant="error">{error || 'Order not found'}</Alert>
            </div>
        );
    }

    const address = order.address || order.shippingAddress;
    const canEdit = order.status !== 'SHIPPED' && order.status !== 'DELIVERED';

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
                                Order Details
                            </h1>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyOrderId}
                                className="flex items-center gap-1"
                            >
                                <Copy className="h-4 w-4" />
                                Copy ID
                            </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-foreground-secondary)] font-mono">
                            <span>{order.id}</span>
                            <span>•</span>
                            <span>Created: {formatDateTime(order.createdAt)}</span>
                            <span>•</span>
                            <span>Updated: {formatDateTime(order.updatedAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleDownloadInvoice}
                            isLoading={downloadingInvoice}
                            disabled={downloadingInvoice}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download Invoice
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="items">Items</TabsTrigger>
                    <TabsTrigger value="payment">Payment</TabsTrigger>
                    <TabsTrigger value="shipping">Shipping</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="invoice">Invoice</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Order Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-600">Order Date</p>
                                    <p className="font-medium">{formatDateTime(order.createdAt)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Order Status</p>
                                    <div className="mt-1">
                                        <OrderStatusBadge status={order.status} />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Payment Method</p>
                                    <p className="font-medium">{order.paymentMethod}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Payment Status</p>
                                    <div className="mt-1">
                                        <PaymentStatusBadge status={order.paymentStatus} />
                                    </div>
                                </div>
                                {order.customerComment && (
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Customer Note</p>
                                        <p className="text-sm text-gray-800 bg-amber-50 border border-amber-200 rounded p-3 whitespace-pre-wrap break-words">
                                            {order.customerComment}
                                        </p>
                                    </div>
                                )}
                                <div className="pt-4 border-t">
                                    {/* Issue #85 — render the breakdown columns directly from
                                        persisted `order.subtotal` + `order.addonsSubtotal` (both
                                        computed by the shared engine at persist time). The
                                        previous fallback re-summed `item.addons[].priceModifier`
                                        client-side, ignoring half-page + perFileEvaluation
                                        gating, which produced a phantom Addons Subtotal even
                                        when the customer paid only the base. We also collapse
                                        the redundant combined "Subtotal" row when there are no
                                        addons (it would duplicate Base Price Subtotal). */}
                                    {(() => {
                                        const baseSubtotal = order.subtotal != null
                                            ? Number(order.subtotal)
                                            : order.items.reduce(
                                                (sum, item) => sum + Number(item.price) * item.quantity,
                                                0,
                                            );
                                        const addonsSubtotal = order.addonsSubtotal != null
                                            ? Number(order.addonsSubtotal)
                                            : 0;

                                        return (
                                            <>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="text-gray-600">Base Price Subtotal</span>
                                                    <span>{formatCurrency(baseSubtotal)}</span>
                                                </div>
                                                {addonsSubtotal > 0 && (
                                                    <>
                                                        <div className="flex justify-between text-sm mb-2">
                                                            <span className="text-gray-600">Addons Subtotal</span>
                                                            <span>{formatCurrency(addonsSubtotal)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm font-medium mb-2 pt-1 border-t border-gray-200">
                                                            <span className="text-gray-700">Subtotal</span>
                                                            <span className="text-gray-900">{formatCurrency(baseSubtotal + addonsSubtotal)}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                    {order.discountAmount && order.discountAmount > 0 && (
                                        <div className="flex justify-between text-sm mb-2 text-green-600">
                                            <span>Discount</span>
                                            <span>-{formatCurrency(order.discountAmount)}</span>
                                        </div>
                                    )}
                                    {order.shippingCharges && order.shippingCharges > 0 && (
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-600">Shipping</span>
                                            <span>{formatCurrency(order.shippingCharges)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                        <span>Total</span>
                                        <span>{formatCurrency(order.total)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Customer Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Customer Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-sm text-gray-600">Name</p>
                                    <p className="font-medium">{order.user?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Email</p>
                                    <a href={`mailto:${order.user?.email}`} className="text-blue-600 hover:underline">
                                        {order.user?.email}
                                    </a>
                                </div>
                                {order.user?.phone && (
                                    <div>
                                        <p className="text-sm text-gray-600">Phone</p>
                                        <a href={`tel:${order.user.phone}`} className="text-blue-600 hover:underline">
                                            {order.user.phone}
                                        </a>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-gray-600">Customer ID</p>
                                    <Link href={`/users/${order.userId}`} className="text-blue-600 hover:underline font-mono text-sm">
                                        {order.userId.slice(0, 8)}...
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Shipping Address */}
                    {address && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Shipping Address
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {(address.name || address.phone) && (
                                        <p className="text-sm">
                                            {address.name && <span className="font-semibold">{address.name}</span>}
                                            {address.name && address.phone && <span className="text-gray-400"> · </span>}
                                            {address.phone && <span className="text-gray-700">{address.phone}</span>}
                                        </p>
                                    )}
                                    <p className="font-medium">{address.street}</p>
                                    <p>
                                        {address.city}, {address.state} {address.zipCode}
                                    </p>
                                    <p>{address.country}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setStatusModalOpen(true)}
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Update Status
                                </Button>
                                {order.status === 'PROCESSING' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setShippingModalOpen(true)}
                                    >
                                        <Truck className="h-4 w-4 mr-2" />
                                        Mark as Shipped
                                    </Button>
                                )}
                                {order.status === 'SHIPPED' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => handleMarkAsDelivered()}
                                    >
                                        <Package className="h-4 w-4 mr-2" />
                                        Mark as Delivered
                                    </Button>
                                )}
                                {order.paymentStatus === 'PENDING' && order.paymentMethod === 'OFFLINE' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setPaymentModalOpen(true)}
                                    >
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        Mark as Paid
                                    </Button>
                                )}
                                {order.status === 'CANCELLED'
                                    && order.paymentMethod === 'ONLINE'
                                    && (order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'REFUNDED')
                                    && order.refundStatus !== 'PROCESSING'
                                    && order.refundStatus !== 'PROCESSED' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setRefundModalOpen(true)}
                                    >
                                        Refund
                                    </Button>
                                    )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Items Tab — readable admin view. Each item is a card with
                    a clear header row (image + name + meta + price tiles)
                    and labelled sections beneath: design files (with image
                    / PDF first-page thumbnails), addons, then price
                    breakdown. Half-page reduction shown inline next to
                    page count. Addons placed before breakdown so the
                    customer-visible upsell numbers are read first. */}
                <TabsContent value="items">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Items ({order.items.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {order.items.map((item, index) => {
                                const meta = item.metadata as any;
                                const pageCount = meta?.pageCount;
                                const copies = meta?.copies;
                                const effectivePages = meta?.effectivePageCount;
                                const hasHalfPage = !!meta?.hasHalfPageAdjustment;

                                const rawUrls: string[] = Array.isArray(item.customDesignUrl)
                                    ? (item.customDesignUrl as string[]).filter(Boolean)
                                    : typeof item.customDesignUrl === 'string' && item.customDesignUrl
                                        ? [item.customDesignUrl]
                                        : [];
                                const publicUrls: string[] = Array.isArray(item.customDesignPresignedUrls)
                                    ? (item.customDesignPresignedUrls as string[]).filter(Boolean)
                                    : [];
                                const fileCount = Math.max(rawUrls.length, publicUrls.length);

                                const breakdown = meta?.priceBreakdown as Array<{ label: string; value: number }> | undefined;
                                // Server-computed per-addon contributions (see issue #75).
                                // Replaces the legacy iteration over `item.addons[]` with
                                // raw `priceModifier` lookups — those values are the rule's
                                // unit price, not what we actually charged for this line.
                                const pricingAddons = item.pricing?.addons;

                                // Display the effective (post-Both-Sides) quantity so admins
                                // see what was actually printed, not the raw PDF page count.
                                const displayQuantity = hasHalfPage && effectivePages
                                    ? Number(effectivePages) * Number(copies || 1)
                                    : item.quantity;

                                // Derive math from each priced breakdown row. Pulls "N pages",
                                // "M copies", or "K files" out of the label and computes the
                                // implied per-unit rate so the row can render the full
                                // formula `pages × copies × ₹rate = ₹total`. Returns null
                                // when the label has no parseable multiplier (e.g. flat-fee
                                // addons, half-page info rows).
                                const parseBreakdownMath = (label: string, value: number) => {
                                    const pagesMatch = label.match(/(\d+(?:\.\d+)?)\s*pages?\b/i);
                                    const copiesMatch = label.match(/(\d+(?:\.\d+)?)\s*cop(?:y|ies)\b/i);
                                    const filesMatch = label.match(/(\d+(?:\.\d+)?)\s*files?\b/i);
                                    const pages = pagesMatch ? Number(pagesMatch[1]) : 0;
                                    const copies = copiesMatch ? Number(copiesMatch[1]) : 0;
                                    const files = filesMatch ? Number(filesMatch[1]) : 0;
                                    const parts: string[] = [];
                                    let multiplier = 1;
                                    if (pages > 0) {
                                        parts.push(`${pages} ${pages === 1 ? 'page' : 'pages'}`);
                                        multiplier *= pages;
                                    }
                                    if (copies > 0) {
                                        parts.push(`${copies} ${copies === 1 ? 'copy' : 'copies'}`);
                                        multiplier *= copies;
                                    }
                                    if (files > 0 && parts.length === 0) {
                                        parts.push(`${files} ${files === 1 ? 'file' : 'files'}`);
                                        multiplier = files;
                                    }
                                    if (multiplier <= 1) return null;
                                    const unit = value / multiplier;
                                    return {
                                        mathStr: `${parts.join(' × ')} × ${formatCurrency(unit)} = ${formatCurrency(value)}`,
                                        unit,
                                    };
                                };

                                // Item total is recomputed from the breakdown (sum of all
                                // priced rows) rather than from the raw stored
                                // `price × quantity` product. The latter under-priced
                                // half-page jobs because the order pipeline stored
                                // `unit = halfRate, qty = rawPages` so `unit × qty` skipped
                                // the ceil() rounding that the pricing rule does. Falls back
                                // to stored math when no breakdown is persisted.
                                const breakdownItemTotal = breakdown && breakdown.length > 0
                                    ? breakdown.reduce((sum, pb) => sum + (pb.value > 0 ? Number(pb.value) : 0), 0)
                                    : item.price * item.quantity;

                                // Show the actual rule per-unit rate (e.g. ₹1.10 per page),
                                // not the stored item.price which can be a stale half-rate
                                // for half-page-published products. Derive from the Base row
                                // in the breakdown when present.
                                const baseRow = breakdown?.find((pb) =>
                                    typeof pb.label === 'string' && pb.label.toLowerCase().startsWith('base')
                                );
                                const baseRowMath = baseRow ? parseBreakdownMath(baseRow.label, Number(baseRow.value)) : null;
                                const displayUnitPrice = baseRowMath?.unit ?? item.price;

                                return (
                                    <div
                                        key={item.id || index}
                                        className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                                    >
                                        {/* Header row */}
                                        <div className="flex flex-col lg:flex-row gap-4 p-5 border-b border-gray-100 bg-gray-50/50">
                                            {item.product?.images?.[0] && (
                                                <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-lg border overflow-hidden bg-white shrink-0">
                                                    <Image
                                                        src={item.product.images[0].url}
                                                        alt={item.product.name}
                                                        fill
                                                        className="object-cover"
                                                        sizes="96px"
                                                        loader={imageLoader}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-gray-900 leading-snug">
                                                    {item.product?.name || `Product ${item.productId}`}
                                                </h3>
                                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                                    {item.product?.category && (
                                                        <span><span className="text-gray-400">Category:</span> {item.product.category.name}</span>
                                                    )}
                                                    {item.product?.sku && (
                                                        <span className="font-mono"><span className="text-gray-400">SKU:</span> {item.product.sku}</span>
                                                    )}
                                                    {item.variant && (
                                                        <span><span className="text-gray-400">Variant:</span> {item.variant.name}</span>
                                                    )}
                                                </div>
                                                {(pageCount || copies) && (
                                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                                        {pageCount && (
                                                            <span>
                                                                <span className="text-gray-400">Pages:</span>{' '}
                                                                <span className="font-medium text-gray-900">{pageCount}</span>
                                                                {hasHalfPage && effectivePages && effectivePages !== pageCount && (
                                                                    <span className="text-blue-600 ml-1">
                                                                        → {effectivePages} effective (Both Sides)
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                        {copies && (
                                                            <span>
                                                                <span className="text-gray-400">Copies:</span>{' '}
                                                                <span className="font-medium text-gray-900">{copies}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Item total derived from breakdown sum; sub-line
                                                shows the rule's actual per-unit rate. */}
                                            <div className="text-right px-4 py-3 bg-blue-50 rounded-lg border border-blue-200 shrink-0 min-w-[120px]">
                                                <div className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold">Item Total</div>
                                                <div className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(breakdownItemTotal)}</div>
                                                <div className="text-[10px] text-blue-500 mt-0.5">
                                                    {displayQuantity} {displayQuantity === 1 ? 'unit' : 'units'} @ {formatCurrency(displayUnitPrice)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-5 space-y-5">
                                            {/* PDF password */}
                                            {(meta?.fileHasPassword || meta?.filePassword) && (
                                                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex flex-wrap gap-2 items-baseline text-sm text-rose-900">
                                                    <span className="text-[11px] uppercase tracking-wide font-bold text-rose-700">PDF Password</span>
                                                    {meta?.filePassword ? (
                                                        <span className="font-mono text-rose-900">{meta.filePassword}</span>
                                                    ) : (
                                                        <span className="italic">Protected · password not provided</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Custom text */}
                                            {item.customText && (
                                                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
                                                    <div className="text-[11px] uppercase tracking-wide font-bold text-gray-500 mb-1">Custom Text</div>
                                                    <p className="text-gray-800 break-words">{item.customText}</p>
                                                </div>
                                            )}

                                            {/* Design files */}
                                            {fileCount > 0 && (
                                                <div>
                                                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                                                        Design Files ({fileCount})
                                                    </h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {Array.from({ length: fileCount }).map((_, fileIndex) => {
                                                            const rawPath = rawUrls[fileIndex] ?? '';
                                                            const href = getPublicFileUrl(publicUrls[fileIndex] || rawPath);
                                                            const fileName = rawPath
                                                                ? getFilenameFromPath(rawPath)
                                                                : `File ${fileIndex + 1}`;
                                                            return (
                                                                <AdminFileTile
                                                                    key={fileIndex}
                                                                    name={fileName}
                                                                    href={href || '#'}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Addons — server-computed contributions to this
                                                line (issue #75). Renders from `pricing.addons[]`
                                                produced by `buildAddonLineDetails` on the api so
                                                the numbers shown here are the same ones the
                                                customer was charged, not the rule's raw
                                                priceModifier. We filter `total <= 0` to drop
                                                rules that didn't fire (e.g. binding tiers whose
                                                page range doesn't match the uploaded file) and
                                                disambiguate duplicate spec-names via the same
                                                `buildAddonLabelMap` helper used in the cart
                                                row + order review. */}
                                            {(() => {
                                                const pricedAddons = (pricingAddons ?? []).filter(
                                                    (a) => Number(a.total || 0) > 0,
                                                );
                                                if (pricedAddons.length === 0) return null;
                                                const labels = buildAddonLabelMap(pricedAddons);
                                                // Resolve uploaded-file URLs back to their stored
                                                // filenames so per-file sub-rows show "design.pdf"
                                                // rather than the FTP basename.
                                                const filenameByUrl = new Map<string, string>();
                                                rawUrls.forEach((url) => {
                                                    if (typeof url === 'string' && url) {
                                                        filenameByUrl.set(url, getFilenameFromPath(url));
                                                    }
                                                });
                                                const resolveFilename = (u: string) => filenameByUrl.get(u);
                                                return (
                                                    <div>
                                                        <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                                                            Addons ({pricedAddons.length})
                                                        </h4>
                                                        <div className="rounded-lg border border-purple-200 bg-purple-50/40 overflow-hidden">
                                                            <div className="divide-y divide-purple-100">
                                                                {pricedAddons.map((addon) => (
                                                                    <div
                                                                        key={addon.ruleId}
                                                                        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 px-3 py-2.5 bg-white"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-medium text-purple-900">
                                                                                {labels.get(addon.ruleId) ?? addon.name}
                                                                            </p>
                                                                            {addon.breakdown && addon.breakdown.length > 1 && (
                                                                                <AddonBreakdownRows
                                                                                    breakdown={addon.breakdown}
                                                                                    resolveFilename={resolveFilename}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div className="text-sm font-semibold text-purple-900 shrink-0 sm:text-right">
                                                                            {formatCurrency(addon.total)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Price breakdown — explicit math. Replaces the
                                                Unit/Qty/Total tiles that didn't visually
                                                balance for half-page orders. Each row
                                                renders the full formula (e.g. "₹0.55 ×
                                                242 = ₹133.10") from the persisted
                                                metadata.priceBreakdown labels, plus a
                                                synthetic Item Total summing all priced
                                                rows so the math foots end-to-end. */}
                                            {breakdown && breakdown.length > 0 && (
                                                <div>
                                                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                                                        Price Breakdown
                                                    </h4>
                                                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                                        <div className="divide-y divide-gray-100">
                                                            {breakdown.map((pb, pbIdx) => {
                                                                const isInfo = pb.value === 0;
                                                                const isHalfPageNote = isInfo && typeof pb.label === 'string' && pb.label.includes('→');
                                                                // Only annotate the Base row with explicit
                                                                // `pages × copies × ₹rate` math. Addons can be
                                                                // flat / per-file / per-page — exposing the
                                                                // implied multiplier on every row added more
                                                                // noise than clarity per UX feedback.
                                                                const isBase = !isInfo && typeof pb.label === 'string'
                                                                    && pb.label.toLowerCase().startsWith('base');
                                                                const math = isBase
                                                                    ? parseBreakdownMath(String(pb.label), Number(pb.value))
                                                                    : null;
                                                                return (
                                                                    <div
                                                                        key={pbIdx}
                                                                        className={`flex justify-between gap-3 px-3 py-2.5 text-sm ${isHalfPageNote ? 'bg-blue-50 text-blue-900' : isInfo ? 'bg-gray-50 text-gray-700' : 'text-gray-900'}`}
                                                                    >
                                                                        <div className="min-w-0 break-words">
                                                                            <div>{pb.label}</div>
                                                                            {math && (
                                                                                <div className="mt-0.5 text-[11px] text-gray-500 font-mono">
                                                                                    {math.mathStr}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {pb.value > 0 ? (
                                                                            <span className="font-semibold shrink-0 tabular-nums">{formatCurrency(pb.value)}</span>
                                                                        ) : (
                                                                            <span className="italic shrink-0 text-xs">
                                                                                {isHalfPageNote ? 'reduction' : 'info'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            <div className="flex justify-between gap-3 px-3 py-2.5 text-sm bg-blue-50/60 border-t border-blue-200">
                                                                <span className="font-bold text-blue-900">Item Total</span>
                                                                <span className="font-bold text-blue-700 shrink-0 tabular-nums">
                                                                    {formatCurrency(breakdownItemTotal)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Template */}
                                            {meta?.templateId && (
                                                <div>
                                                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                                                        Template
                                                    </h4>
                                                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                                                        <TemplateDisplay
                                                            templateId={meta.templateId}
                                                            categoryId={item.product?.category?.id}
                                                            formData={meta.templateFormData}
                                                            formImages={meta.templateFormImages}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Summary footer — sum effective (post-Both-Sides)
                                quantities so the unit count matches what's
                                actually printed, not the raw uploaded page
                                count. Mirrors the per-item displayQuantity. */}
                            <div className="pt-4 border-t-2 flex justify-between items-baseline">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Total Items</p>
                                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                                        {order.items.reduce((sum, item) => {
                                            const m = item.metadata as any;
                                            const eff = m?.hasHalfPageAdjustment && m?.effectivePageCount
                                                ? Number(m.effectivePageCount) * Number(m.copies || 1)
                                                : item.quantity;
                                            return sum + eff;
                                        }, 0)} unit(s)
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Order Total</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(order.total)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Payment Tab */}
                <TabsContent value="payment">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600">Payment Method</p>
                                <p className="font-medium">{order.paymentMethod}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Payment Status</p>
                                <div className="mt-1">
                                    <PaymentStatusBadge status={order.paymentStatus} />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Amount</p>
                                <p className="font-bold text-xl">{formatCurrency(order.total)}</p>
                            </div>
                            {order.refundStatus && (
                                <div>
                                    <p className="text-sm text-gray-600">Refund Status</p>
                                    <p className="font-medium">{order.refundStatus.replace(/_/g, ' ')}</p>
                                    {order.refundFailureReason && (
                                        <p className="text-xs text-red-600 mt-1">{order.refundFailureReason}</p>
                                    )}
                                </div>
                            )}
                            {order.payments && order.payments.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Payment History</p>
                                    <div className="space-y-2">
                                        {order.payments.map((payment) => (
                                            <div key={payment.id} className="p-3 bg-gray-50 rounded">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {formatDateTime(payment.createdAt)}
                                                        </p>
                                                        {payment.gatewayTransactionId && (
                                                            <p className="text-xs text-gray-400 font-mono mt-1">
                                                                ID: {payment.gatewayTransactionId}
                                                            </p>
                                                        )}
                                                        {payment.paymentInstrument && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                via {payment.paymentInstrument}
                                                                {payment.paymentDetails?.vpa ? ` (${payment.paymentDetails.vpa})` : ''}
                                                                {payment.paymentDetails?.cardNetwork ? ` (${payment.paymentDetails.cardNetwork}${payment.paymentDetails?.last4 ? ` ****${payment.paymentDetails.last4}` : ''})` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <PaymentStatusBadge status={payment.status} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {order.refunds && order.refunds.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Refund History</p>
                                    <div className="space-y-2">
                                        {order.refunds.map((refund) => (
                                            <div key={refund.id} className="p-3 bg-gray-50 rounded">
                                                <p className="font-medium">{formatCurrency(refund.amount)}</p>
                                                <p className="text-xs text-gray-500">{refund.status}</p>
                                                {refund.gatewayRefundId && (
                                                    <p className="text-xs font-mono text-gray-500">ID: {refund.gatewayRefundId}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Shipping Tab */}
                <TabsContent value="shipping">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipping Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {address && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Shipping Address</p>
                                    <div className="p-3 bg-gray-50 rounded">
                                        <p className="font-medium">{address.street}</p>
                                        <p>
                                            {address.city}, {address.state} {address.zipCode}
                                        </p>
                                        <p>{address.country}</p>
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-gray-600">Shipping Charges</p>
                                <p className="font-medium">{formatCurrency(order.shippingCharges || 0)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline">
                    <Card>
                        <CardHeader>
                            <CardTitle>Status History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {order.statusHistory && order.statusHistory.length > 0 ? (
                                <div className="space-y-4">
                                    {order.statusHistory.map((history, index) => (
                                        <div key={history.id} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full ${index === order.statusHistory!.length - 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                                {index < order.statusHistory!.length - 1 && (
                                                    <div className="w-0.5 h-full bg-gray-300 mt-1" />
                                                )}
                                            </div>
                                            <div className="flex-1 pb-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <OrderStatusBadge status={history.status} />
                                                    <span className="text-sm text-gray-500">
                                                        {formatDateTime(history.createdAt)}
                                                    </span>
                                                </div>
                                                {history.comment && (
                                                    <p className="text-sm text-gray-600 mt-1">{history.comment}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">No status history available</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Invoice Tab */}
                <TabsContent value="invoice">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Invoice</span>
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadInvoice}
                                    isLoading={downloadingInvoice}
                                    disabled={downloadingInvoice}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Invoice
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingInvoice || (activeTab === 'invoice' && !invoicePdfUrl) ? (
                                <div className="flex items-center justify-center min-h-[600px]">
                                    <PageLoading />
                                </div>
                            ) : invoicePdfUrl ? (
                                <div className="w-full border rounded-lg overflow-hidden">
                                    <iframe
                                        src={invoicePdfUrl}
                                        className="w-full h-[800px] border-0"
                                        title="Invoice PDF"
                                    />
                                </div>
                            ) : (
                                <div className="bg-gray-50 p-4 rounded">
                                    <p className="text-gray-600">Failed to load invoice. Please try downloading it.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Status Update Modal */}
            <StatusUpdateModal
                open={statusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                currentStatus={order.status}
                onUpdate={handleStatusUpdate}
            />

            {/* Shipping Modal */}
            <ShippingModal
                open={shippingModalOpen}
                onClose={() => setShippingModalOpen(false)}
                onShip={handleMarkAsShipped}
            />

            {/* Payment Modal */}
            <PaymentModal
                open={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                order={order}
                onPaid={async () => {
                    await loadOrder();
                    setPaymentModalOpen(false);
                }}
            />

            {/* Refund Modal */}
            <RefundModal
                open={refundModalOpen}
                onClose={() => setRefundModalOpen(false)}
                order={order}
                onRefund={async () => {
                    await loadOrder();
                    setRefundModalOpen(false);
                }}
            />
        </div>
    );
}

// Status Update Modal
function StatusUpdateModal({
    open,
    onClose,
    currentStatus,
    onUpdate,
}: {
    open: boolean;
    onClose: () => void;
    currentStatus: OrderStatus;
    onUpdate: (status: OrderStatus, comment?: string) => void;
}) {
    const [status, setStatus] = useState<OrderStatus>(currentStatus);
    const [comment, setComment] = useState('');

    const statusOptions: OrderStatus[] = [
        'PENDING_REVIEW',
        'ACCEPTED',
        'REJECTED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
    ];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogClose onClose={onClose} />
                <DialogHeader>
                    <DialogTitle>Update Order Status</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>New Status</Label>
                        <select
                            className="w-full mt-1 p-2 border rounded"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as OrderStatus)}
                        >
                            {statusOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label>Comment (Optional)</Label>
                        <Input
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Add a note about this status change"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onUpdate(status, comment || undefined)}>Update Status</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Shipping Modal
function ShippingModal({
    open,
    onClose,
    onShip,
}: {
    open: boolean;
    onClose: () => void;
    onShip: (trackingNumber: string, carrier?: string) => void;
}) {
    const [trackingNumber, setTrackingNumber] = useState('');
    const [carrier, setCarrier] = useState('');

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogClose onClose={onClose} />
                <DialogHeader>
                    <DialogTitle>Mark Order as Shipped</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>Tracking Number *</Label>
                        <Input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Enter tracking number"
                            required
                        />
                    </div>
                    <div>
                        <Label>Carrier (Optional)</Label>
                        <Input
                            type="text"
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                            placeholder="e.g., FedEx, UPS, USPS"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => {
                            if (trackingNumber) {
                                onShip(trackingNumber, carrier || undefined);
                                setTrackingNumber('');
                                setCarrier('');
                            }
                        }}
                        disabled={!trackingNumber}
                    >
                        Mark as Shipped
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Payment Modal
function PaymentModal({
    open,
    onClose,
    order,
    onPaid,
}: {
    open: boolean;
    onClose: () => void;
    order: Order;
    onPaid: () => void;
}) {
    const [amount, setAmount] = useState(order.total.toString());
    const [reference, setReference] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            await markPaymentAsPaid(order.id, {
                amount: parseFloat(amount),
                reference: reference || undefined,
            });
            onPaid();
            toastSuccess('Payment marked as paid');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to mark payment as paid');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogClose onClose={onClose} />
                <DialogHeader>
                    <DialogTitle>Mark Payment as Paid</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>Amount</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            step="0.01"
                        />
                    </div>
                    <div>
                        <Label>Reference / Notes</Label>
                        <Input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Payment reference or notes"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Processing...' : 'Mark as Paid'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Refund Modal
function RefundModal({
    open,
    onClose,
    order,
    onRefund,
}: {
    open: boolean;
    onClose: () => void;
    order: Order;
    onRefund: () => void;
}) {
    const [amount, setAmount] = useState(order.total.toString());
    const [reason, setReason] = useState('');
    const [adminNote, setAdminNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            await processRefund(order.id, {
                amount: parseFloat(amount),
                reason: reason.trim() || undefined,
                adminNote: adminNote.trim() || undefined,
            });
            onRefund();
            toastSuccess('Refund processed successfully');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to process refund');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogClose onClose={onClose} />
                <DialogHeader>
                    <DialogTitle>Process Refund</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>Refund Amount</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            step="0.01"
                            max={order.total}
                        />
                        <p className="text-xs text-gray-500 mt-1">Order total: {formatCurrency(order.total)}</p>
                    </div>
                    <div>
                        <Label>Refund Reason</Label>
                        <Input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason for refund (optional)"
                        />
                    </div>
                    <div>
                        <Label>Admin Note</Label>
                        <Input
                            type="text"
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="Internal note (optional)"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Processing...' : 'Process Refund'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
