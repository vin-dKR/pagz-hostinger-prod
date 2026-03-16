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
import { OrderStatusBadge, PaymentStatusBadge } from './status-badge';
import {
    ArrowLeft,
    Copy,
    Download,
    Mail,
    Package,
    Truck,
    CreditCard,
    Clock,
    MapPin,
    User
} from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess, toastWarning } from '@/lib/utils/toast';
import Image from 'next/image';
import { imageLoader } from '@/lib/utils/image-loader';
import { TemplateDisplay } from './TemplateDisplay';

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
            toastError(err instanceof Error ? err.message : 'Failed to load invoice');
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
                                <div className="pt-4 border-t">
                                    {/* Use stored values from database, with fallback calculation */}
                                    {(() => {
                                        // Use stored subtotal from database (base price only)
                                        const baseSubtotal = order.subtotal !== null && order.subtotal !== undefined
                                            ? Number(order.subtotal)
                                            : order.items.reduce((sum, item) => {
                                                return sum + (Number(item.price) * item.quantity);
                                            }, 0);

                                        // Use stored addonsSubtotal from database, fallback to calculating if not stored
                                        const addonsSubtotal = (() => {
                                            // First try database value
                                            if (order.addonsSubtotal !== null && order.addonsSubtotal !== undefined && order.addonsSubtotal > 0) {
                                                return Number(order.addonsSubtotal);
                                            }
                                            // Fallback: calculate from items' addons
                                            return order.items.reduce((sum, item) => {
                                                const addons = Array.isArray((item as any).addons) ? (item as any).addons : [];
                                                const pageCount = (item as any).metadata?.pageCount || 1;
                                                const copies = (item as any).metadata?.copies || 1;
                                                const effectivePages = pageCount > 1 ? pageCount * copies : null;

                                                const itemAddonsTotal = addons.reduce((addonSum: number, addon: any) => {
                                                    // Check page range if addon has minQuantity/maxQuantity
                                                    const hasPageRange = addon.minQuantity != null || addon.maxQuantity != null;
                                                    if (hasPageRange && effectivePages != null) {
                                                        const inRange =
                                                            (addon.minQuantity == null || effectivePages >= addon.minQuantity) &&
                                                            (addon.maxQuantity == null || effectivePages <= addon.maxQuantity);
                                                        if (!inRange) {
                                                            return addonSum; // Skip this addon if not in range
                                                        }
                                                    }

                                                    const rawPrice =
                                                        addon.priceModifier !== null && addon.priceModifier !== undefined
                                                            ? Number(addon.priceModifier)
                                                            : addon.basePrice !== null && addon.basePrice !== undefined
                                                                ? Number(addon.basePrice)
                                                                : 0;

                                                    // Calculate multiplier based on quantity multiplier and page count
                                                    let multiplier = 1;
                                                    if (addon.quantityMultiplier) {
                                                        if (effectivePages != null) {
                                                            multiplier = effectivePages;
                                                        } else {
                                                            multiplier = item.quantity;
                                                        }
                                                    }

                                                    return addonSum + rawPrice * multiplier;
                                                }, 0);
                                                return sum + itemAddonsTotal;
                                            }, 0);
                                        })();

                                        return (
                                            <>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="text-gray-600">Base Price Subtotal</span>
                                                    <span>{formatCurrency(baseSubtotal)}</span>
                                                </div>
                                                {addonsSubtotal > 0 && (
                                                    <div className="flex justify-between text-sm mb-2">
                                                        <span className="text-gray-600">Addons Subtotal</span>
                                                        <span>{formatCurrency(addonsSubtotal)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm font-medium mb-2 pt-1 border-t border-gray-200">
                                                    <span className="text-gray-700">Subtotal</span>
                                                    <span className="text-gray-900">{formatCurrency(baseSubtotal + addonsSubtotal)}</span>
                                                </div>
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
                                {order.paymentStatus === 'SUCCESS' && (
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

                {/* Items Tab */}
                <TabsContent value="items">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Items ({order.items.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-8">
                                {order.items.map((item, index) => (
                                    <Card key={item.id || index} className="border-2">
                                        <CardContent className="p-6">
                                            <div className="space-y-3">
                                                {/* Main Product Info Section */}
                                                <div className="flex flex-col lg:flex-row gap-6 items-start">
                                                    {/* Product Image */}
                                                    {item.product?.images?.[0] && (
                                                        <div className="w-32 h-32 rounded-lg border-2 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                                                            <Image
                                                                src={item.product.images[0].url}
                                                                alt={item.product.name}
                                                                className="w-full h-full object-cover"
                                                                width={128}
                                                                height={128}
                                                                loader={imageLoader}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Product Details and Price */}
                                                    <div className="flex-1 min-w-0 w-full">
                                                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                                                            {/* Product Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                                                                    {item.product?.name || `Product ${item.productId}`}
                                                                </h3>
                                                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                                                                    {item.product?.sku && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="font-medium">SKU:</span>
                                                                            <span className="font-mono">{item.product.sku}</span>
                                                                        </span>
                                                                    )}
                                                                    {item.variant && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="font-medium">Variant:</span>
                                                                            <span>{item.variant.name}</span>
                                                                        </span>
                                                                    )}
                                                                    {item.product?.category && (
                                                                        <span className="flex items-center gap-1">
                                                                            <span className="font-medium">Category:</span>
                                                                            <span>{item.product.category.name}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Price Section */}
                                                            <div className="flex flex-row gap-3 shrink-0 justify-start lg:justify-end">
                                                                <div className="bg-gray-50 rounded-lg px-4 py-3 border text-center min-w-[100px] lg:min-w-[120px]">
                                                                    <p className="text-xs text-gray-600 mb-1">Unit Price</p>
                                                                    <p className="text-base lg:text-lg font-semibold text-gray-900">
                                                                        {formatCurrency(item.price)}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-gray-50 rounded-lg px-4 py-3 border text-center min-w-[80px] lg:min-w-[100px]">
                                                                    <p className="text-xs text-gray-600 mb-1">Quantity</p>
                                                                    <p className="text-base lg:text-lg font-semibold text-gray-900">
                                                                        {item.quantity}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-gray-50 rounded-lg px-4 py-3 border text-center min-w-[110px] lg:min-w-[140px]">
                                                                    <p className="text-xs text-gray-600 mb-1">Total</p>
                                                                    <p className="text-lg lg:text-xl font-bold text-gray-900">
                                                                        {formatCurrency(item.price * item.quantity)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Specifications Section */}
                                                {(item.metadata?.pageCount || item.metadata?.copies) && (
                                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                        <h4 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">
                                                            Specifications
                                                        </h4>
                                                        <div className="flex gap-6">
                                                            {item.metadata.pageCount && (
                                                                <div>
                                                                    <span className="text-xs text-blue-700 font-medium">Pages</span>
                                                                    <p className="text-lg font-bold text-blue-900">{item.metadata.pageCount}</p>
                                                                </div>
                                                            )}
                                                            {item.metadata.copies && (
                                                                <div>
                                                                    <span className="text-xs text-blue-700 font-medium">Copies</span>
                                                                    <p className="text-lg font-bold text-blue-900">{item.metadata.copies}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Custom Text */}
                                                {item.customText && (
                                                    <div className="bg-gray-50 rounded-lg p-4 border">
                                                        <h4 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide">
                                                            Custom Text
                                                        </h4>
                                                        <p className="text-base text-gray-800">{item.customText}</p>
                                                    </div>
                                                )}

                                                {/* Custom Design Files */}
                                                {((Array.isArray(item.customDesignUrl) && item.customDesignUrl.length > 0) ||
                                                    (typeof item.customDesignUrl === 'string' && item.customDesignUrl) ||
                                                    (Array.isArray(item.customDesignPresignedUrls) && item.customDesignPresignedUrls.length > 0) ||
                                                    item.customDesignPresignedUrl) && (
                                                        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                                                            <h4 className="font-semibold text-indigo-900 mb-3 text-sm uppercase tracking-wide">
                                                                Custom Design Files {Array.isArray(item.customDesignUrl) ? `(${item.customDesignUrl.length})` : ''}
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {Array.isArray(item.customDesignPresignedUrls) && item.customDesignPresignedUrls.length > 0 ? (
                                                                    item.customDesignPresignedUrls.map((presignedUrl, fileIndex) => {
                                                                        const fileUrl = Array.isArray(item.customDesignUrl) ? item.customDesignUrl[fileIndex] : '';
                                                                        const fileName = fileUrl ? fileUrl.split('/').pop() : `File ${fileIndex + 1}`;
                                                                        return (
                                                                            <a
                                                                                key={fileIndex}
                                                                                href={presignedUrl || fileUrl || '#'}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                                                                            >
                                                                                <Download className="h-5 w-5 text-indigo-600 shrink-0" />
                                                                                <span className="text-sm font-medium text-indigo-900 flex-1">
                                                                                    {fileName}
                                                                                </span>
                                                                            </a>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <a
                                                                        href={item.customDesignPresignedUrl || (typeof item.customDesignUrl === 'string' ? item.customDesignUrl : '') || '#'}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                                                                    >
                                                                        <Download className="h-5 w-5 text-indigo-600 shrink-0" />
                                                                        <span className="text-sm font-medium text-indigo-900">
                                                                            View/Download File
                                                                        </span>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Template Data and Price Breakdown in Row */}
                                                {(item.metadata?.templateId || (item.metadata?.priceBreakdown && item.metadata.priceBreakdown.length > 0)) && (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        {/* Template Data */}
                                                        {item.metadata?.templateId && (
                                                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                                                <h4 className="font-semibold text-amber-900 mb-3 text-sm uppercase tracking-wide">
                                                                    Template Information
                                                                </h4>
                                                                <TemplateDisplay
                                                                    templateId={item.metadata.templateId}
                                                                    categoryId={item.product?.category?.id}
                                                                    formData={item.metadata.templateFormData}
                                                                    formImages={item.metadata.templateFormImages}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Price Breakdown */}
                                                        {item.metadata?.priceBreakdown && item.metadata.priceBreakdown.length > 0 && (
                                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                                <h4 className="font-semibold text-green-900 mb-3 text-sm uppercase tracking-wide">
                                                                    Price Breakdown
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {item.metadata.priceBreakdown.map((pbItem, pbIdx) => {
                                                                        const isHalfPageAdjustment = pbItem.value === 0 &&
                                                                            typeof pbItem.label === 'string' &&
                                                                            (pbItem.label.toLowerCase().includes('both side') ||
                                                                                pbItem.label.toLowerCase().includes('half page') ||
                                                                                pbItem.label.toLowerCase().includes('→'));

                                                                        return (
                                                                            <div
                                                                                key={pbIdx}
                                                                                className={`flex justify-between items-center p-2 rounded ${isHalfPageAdjustment
                                                                                    ? 'bg-blue-100 border border-blue-300'
                                                                                    : 'bg-white border border-green-200'
                                                                                    }`}
                                                                            >
                                                                                <span className={`text-sm ${isHalfPageAdjustment
                                                                                    ? 'text-blue-900 font-medium'
                                                                                    : 'text-green-900'
                                                                                    }`}>
                                                                                    {pbItem.label}
                                                                        </span>
                                                                        {pbItem.value > 0 ? (
                                                                            <span className={`text-sm font-semibold ${isHalfPageAdjustment
                                                                                ? 'text-blue-900'
                                                                                : 'text-green-900'
                                                                                }`}>
                                                                                {formatCurrency(pbItem.value)}
                                                                            </span>
                                                                        ) : isHalfPageAdjustment && (
                                                                            <span className="text-xs text-blue-600 italic">
                                                                                Info
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Addons Section */}
                                                {Array.isArray((item as any).addons) && (item as any).addons.length > 0 && (
                                                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                        <h4 className="font-semibold text-purple-900 mb-3 text-sm uppercase tracking-wide">
                                                            Addons ({(item as any).addons.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {((item as any).addons as any[]).map((addon, addonIdx) => {
                                                                const rawPrice =
                                                                    addon.priceModifier !== null && addon.priceModifier !== undefined
                                                                        ? Number(addon.priceModifier)
                                                                        : addon.basePrice !== null && addon.basePrice !== undefined
                                                                            ? Number(addon.basePrice)
                                                                            : 0;
                                                                const pageCount = (item as any).metadata?.pageCount || 1;
                                                                const copies = (item as any).metadata?.copies || 1;
                                                                const effectivePages = pageCount > 1 ? pageCount * copies : null;
                                                                const multiplier = addon.quantityMultiplier
                                                                    ? (effectivePages != null ? effectivePages : item.quantity)
                                                                    : 1;
                                                                const total = rawPrice * multiplier;
                                                                const specValues = (addon.specificationValues || {}) as Record<string, any>;
                                                                const specDetails = Object.entries(specValues)
                                                                    .map(([key, value]) => `${key}: ${value}`)
                                                                    .join(', ');

                                                                return (
                                                                    <div key={addonIdx} className="bg-white rounded-lg p-3 border border-purple-200">
                                                                        <div className="flex justify-between items-start gap-4">
                                                                            <div className="flex-1">
                                                                                <p className="font-medium text-purple-900 text-sm mb-1">
                                                                                    {specDetails || `Addon ${addonIdx + 1}`}
                                                                                </p>
                                                                                {addon.ruleType && (
                                                                                    <p className="text-xs text-purple-600">
                                                                                        Type: {addon.ruleType.replace(/_/g, ' ')}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                <p className="text-sm font-semibold text-purple-900">
                                                                                    {formatCurrency(rawPrice)}
                                                                                    {multiplier > 1 && (
                                                                                        <span className="text-xs text-purple-600 ml-1">
                                                                                            × {multiplier}
                                                                                        </span>
                                                                                    )}
                                                                                </p>
                                                                                {multiplier > 1 && (
                                                                                    <p className="text-xs font-bold text-purple-900 mt-1">
                                                                                        = {formatCurrency(total)}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {/* Summary Footer */}
                                <div className="pt-6 border-t-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">Total Items</p>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600 mb-1">Order Total</p>
                                            <p className="text-3xl font-bold text-gray-900">
                                                {formatCurrency(order.total)}
                                            </p>
                                        </div>
                                    </div>
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
                                                        {payment.phonePeTransactionId && (
                                                            <p className="text-xs text-gray-400 font-mono mt-1">
                                                                ID: {payment.phonePeTransactionId}
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toastWarning('Please provide a refund reason');
            return;
        }
        try {
            setIsSubmitting(true);
            await processRefund(order.id, {
                amount: parseFloat(amount),
                reason,
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
                        <Label>Refund Reason *</Label>
                        <Input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason for refund"
                            required
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !reason.trim()}>
                        {isSubmitting ? 'Processing...' : 'Process Refund'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
