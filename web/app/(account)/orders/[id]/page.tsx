"use client";

import Link from "next/link";
import Image from "next/image";
import { imageLoader } from "@/lib/utils/image-loader";
import { use, useState, useEffect } from "react";
import {
    Package,
    Truck,
    CreditCard,
    MapPin,
    Download,
    HelpCircle,
    ArrowLeft,
    Check,
    Printer,
} from "lucide-react";
import { getOrder, type Order, type OrderStatusHistory } from "@/lib/api/orders";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";

interface OrderItem {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
    image?: string;
    customDesignUrl?: string[]; // Array of S3 URLs
    variant?: string;
    addonsTotal?: number;
}

interface OrderStatusHistoryDisplay {
    status: string;
    date: string;
    description: string;
}

interface OrderDetails {
    id: string;
    orderNumber: string;
    date: string;
    status: "Delivered" | "Shipped" | "Processing" | "Cancelled" | "Pending Review" | "Accepted" | "Rejected";
    total: number;
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    items: OrderItem[];
    shippingAddress: {
        name: string;
        phone: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    paymentMethod: string;
    paymentStatus: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
    statusHistory: OrderStatusHistoryDisplay[];
}

// Transform backend order to display format
function transformOrder(order: Order): OrderDetails {
    const statusMap: Record<string, "Delivered" | "Shipped" | "Processing" | "Cancelled" | "Pending Review" | "Accepted" | "Rejected"> = {
        "PENDING_REVIEW": "Pending Review",
        "ACCEPTED": "Accepted",
        "REJECTED": "Rejected",
        "PROCESSING": "Processing",
        "SHIPPED": "Shipped",
        "DELIVERED": "Delivered",
        "CANCELLED": "Cancelled",
    };

    const paymentStatusMap: Record<string, string> = {
        "PENDING": "Pending",
        "SUCCESS": "Paid",
        "FAILED": "Failed",
        "REFUNDED": "Refunded",
    };

    const paymentMethodMap: Record<string, string> = {
        "ONLINE": "Online Payment",
        "OFFLINE": "Cash on Delivery",
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    // Transform status history
    const statusHistory: OrderStatusHistoryDisplay[] = (order.statusHistory || []).map((history: OrderStatusHistory) => ({
        status: statusMap[history.status] || history.status,
        date: formatDateTime(history.createdAt),
        description: history.comment || `Status updated to ${statusMap[history.status] || history.status}`,
    }));

    // Add initial order placed status if not present
    if (statusHistory.length === 0 || statusHistory[0]?.status !== "Order Placed") {
        statusHistory.unshift({
            status: "Order Placed",
            date: formatDateTime(order.createdAt),
            description: "Your order has been placed successfully",
        });
    }

    return {
        id: order.id,
        orderNumber: `ORD-${order.id.slice(0, 8).toUpperCase()}`,
        date: formatDate(order.createdAt),
        status: statusMap[order.status] || "Processing",
        total: Number(order.total),
        subtotal: Number(order.subtotal || 0),
        shipping: Number(order.shippingCharges || 0),
        tax: 0, // Tax is typically included in subtotal or calculated separately
        discount: Number(order.discountAmount || 0),
        items: order.items.map((item: any) => {
            const addons = Array.isArray(item.addons) ? item.addons : [];
            const addonsTotal = addons.reduce((sum: number, addon: any) => {
                const rawPrice =
                    addon.priceModifier !== null && addon.priceModifier !== undefined
                        ? Number(addon.priceModifier)
                        : addon.basePrice !== null && addon.basePrice !== undefined
                            ? Number(addon.basePrice)
                            : 0;
                const multiplier = addon.quantityMultiplier ? item.quantity : 1;
                return sum + rawPrice * multiplier;
            }, 0);

            return {
                id: item.id,
                productId: item.productId,
                name: item.product?.name || "Unknown Product",
                quantity: item.quantity,
                price: Number(item.price),
                image: item.product?.images?.[0]?.url,
                customDesignUrl: item.customDesignUrl,
                variant: item.variant?.name,
                addonsTotal: addonsTotal > 0 ? addonsTotal : undefined,
            } as OrderItem;
        }),
        shippingAddress: {
            name: "", // Address doesn't have name in current schema
            phone: "", // Address doesn't have phone in current schema
            street: order.address?.street || "",
            city: order.address?.city || "",
            state: order.address?.state || "",
            zipCode: order.address?.zipCode || "",
            country: order.address?.country || "",
        },
        paymentMethod: paymentMethodMap[order.paymentMethod] || order.paymentMethod,
        paymentStatus: paymentStatusMap[order.paymentStatus] || order.paymentStatus,
        statusHistory,
    };
}

const statusColors: Record<string, string> = {
    "Delivered": "bg-green-100 text-green-700 border border-green-200",
    "Shipped": "bg-blue-100 text-blue-700 border border-blue-200",
    "Processing": "bg-yellow-100 text-yellow-700 border border-yellow-200",
    "Cancelled": "bg-red-100 text-red-700 border border-red-200",
    "Pending Review": "bg-gray-100 text-gray-700 border border-gray-200",
    "Accepted": "bg-green-100 text-green-700 border border-green-200",
    "Rejected": "bg-red-100 text-red-700 border border-red-200",
};

function OrderDetailsPageContent({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchOrder() {
            try {
                setLoading(true);
                setError(null);
                const response = await getOrder(id);

                if (response.success && response.data) {
                    setOrder(transformOrder(response.data));
                } else {
                    setError(response.error || "Failed to load order");
                }
            } catch (err) {
                console.error("Error fetching order:", err);
                setError(err instanceof Error ? err.message : "Failed to load order");
            } finally {
                setLoading(false);
            }
        }

        fetchOrder();
    }, [id]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <BarsSpinner />
            </div>
        );
    }

    if (error || !order) {
        return (
            <>
                <div className="flex-1">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <Package className="text-gray-400 w-8 h-8" />
                        </div>
                        <p className="text-lg font-hkgb text-gray-900 mb-2">
                            Order not found
                        </p>
                        <p className="text-gray-600 text-sm mb-6">
                            {error || "The order you're looking for doesn't exist or has been removed"}
                        </p>
                        <Link
                            href="/orders"
                            className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors font-hkgb text-sm"
                        >
                            Back to Orders
                        </Link>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* Main Content */}
            <div className="flex-1">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href="/orders"
                        className="inline-flex items-center gap-2 text-[#008ECC] hover:text-[#0077B3] mb-4 text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Orders
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-hkgb text-gray-900 mb-2">
                                Order Details
                            </h1>
                            <p className="text-gray-600 text-sm sm:text-base">
                                Order #{order.orderNumber} • Placed on{" "}
                                {order.date}
                            </p>
                        </div>
                        <span
                            className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${statusColors[order.status]
                                }`}
                        >
                            {order.status}
                        </span>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Left Column - Order Items & Timeline */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        {/* Order Items */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-hkgb text-gray-900 mb-4">
                                Order Items ({order.items.length})
                            </h2>
                            <div className="space-y-4">
                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-all duration-300"
                                    >
                                        {/* Product Image */}
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
                                            {item.image ? (
                                                <Image
                                                    src={item.image}
                                                    alt={item.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 640px) 64px, 80px"
                                                    loader={imageLoader}
                                                />
                                            ) : (
                                                <Package className="text-gray-400 w-6 h-6 sm:w-8 sm:h-8" />
                                            )}
                                        </div>

                                        {/* Product Details */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-1 truncate">
                                                {item.name}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-600 mb-2">
                                                {item.variant && (
                                                    <span className="bg-gray-50 px-2 py-1 rounded">
                                                        Variant: {item.variant}
                                                    </span>
                                                )}
                                                <span className="bg-gray-50 px-2 py-1 rounded">
                                                    Qty: {item.quantity}
                                                </span>
                                                {item.customDesignUrl && (
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                        Custom Design
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm sm:text-base font-hkgb text-gray-900">
                                                        ₹{item.price.toFixed(2)}
                                                    </p>
                                                    <Link
                                                        href={`/products/${item.productId || item.id}`}
                                                        className="text-xs sm:text-sm text-[#008ECC] hover:text-[#0077B3] font-medium"
                                                    >
                                                        View Product
                                                    </Link>
                                                </div>
                                                {typeof item.addonsTotal === "number" && item.addonsTotal > 0 && (
                                                    <p className="text-xs text-gray-600">
                                                        Addons: <span className="font-medium">₹{item.addonsTotal.toFixed(2)}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Status Timeline */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-hkgb text-gray-900 mb-4">
                                Order Status Timeline
                            </h2>
                            <div className="relative">
                                {/* Timeline Line */}
                                <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                                {/* Timeline Items */}
                                <div className="space-y-6">
                                    {order.statusHistory.map(
                                        (historyItem, index) => {
                                            const isLast =
                                                index ===
                                                order.statusHistory.length - 1;
                                            const isActive =
                                                isLast ||
                                                order.status ===
                                                historyItem.status;

                                            return (
                                                <div
                                                    key={index}
                                                    className="relative flex gap-3 sm:gap-4"
                                                >
                                                    {/* Timeline Dot */}
                                                    <div className="relative z-10 shrink-0">
                                                        <div
                                                            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${isActive
                                                                ? "bg-[#008ECC]"
                                                                : "bg-gray-200"
                                                                }`}
                                                        >
                                                            {isActive && (
                                                                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Timeline Content */}
                                                    <div className="flex-1 pb-6">
                                                        <div
                                                            className={`font-medium mb-1 text-sm sm:text-base ${isActive
                                                                ? "text-gray-900 font-hkgb"
                                                                : "text-gray-500"
                                                                }`}
                                                        >
                                                            {historyItem.status}
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-gray-600 mb-1">
                                                            {historyItem.date}
                                                        </p>
                                                        <p className="text-xs sm:text-sm text-gray-500">
                                                            {
                                                                historyItem.description
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tracking Information */}
                        {order.trackingNumber && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Truck className="text-[#008ECC] w-5 h-5 sm:w-6 sm:h-6" />
                                    <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                                        Tracking Information
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">
                                            Tracking Number
                                        </p>
                                        <p className="text-base font-hkgb text-gray-900">
                                            {order.trackingNumber}
                                        </p>
                                    </div>
                                    {order.estimatedDelivery && (
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">
                                                Estimated Delivery
                                            </p>
                                            <p className="text-base font-hkgb text-gray-900">
                                                {order.estimatedDelivery}
                                            </p>
                                        </div>
                                    )}
                                    <button className="mt-3 px-4 py-2.5 border border-[#008ECC] text-[#008ECC] rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">
                                        Track Package
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Order Summary & Details */}
                    <div className="space-y-4 sm:space-y-6">
                        {/* Order Summary */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-hkgb text-gray-900 mb-4">
                                Order Summary
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">
                                        Subtotal
                                    </span>
                                    <span className="text-gray-900 font-medium">
                                        ₹{order.subtotal.toFixed(2)}
                                    </span>
                                </div>
                                {order.shipping > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                            Shipping
                                        </span>
                                        <span className="text-gray-900 font-medium">
                                            ₹{order.shipping.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                {order.tax > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                            Tax
                                        </span>
                                        <span className="text-gray-900 font-medium">
                                            ₹{order.tax.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                {order.discount > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Discount</span>
                                        <span className="font-medium">
                                            -₹{order.discount.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between">
                                        <span className="text-base font-hkgb text-gray-900">
                                            Total Amount
                                        </span>
                                        <span className="text-lg sm:text-xl font-hkgb text-[#008ECC]">
                                            ₹{order.total.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Shipping Address */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <MapPin className="text-[#008ECC] w-5 h-5 sm:w-6 sm:h-6" />
                                <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                                    Shipping Address
                                </h2>
                            </div>
                            <div className="space-y-1 text-sm text-gray-700">
                                <p className="font-hkgb text-gray-900">
                                    {order.shippingAddress.name}
                                </p>
                                <p className="text-gray-600">
                                    {order.shippingAddress.phone}
                                </p>
                                <p className="mt-2 text-gray-900">
                                    {order.shippingAddress.street}
                                </p>
                                <p className="text-gray-600">
                                    {order.shippingAddress.city},{" "}
                                    {order.shippingAddress.state}{" "}
                                    {order.shippingAddress.zipCode}
                                </p>
                                <p className="text-gray-600">
                                    {order.shippingAddress.country}
                                </p>
                            </div>
                        </div>

                        {/* Payment Information */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <CreditCard className="text-[#008ECC] w-5 h-5 sm:w-6 sm:h-6" />
                                <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                                    Payment Information
                                </h2>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">
                                        Payment Method
                                    </p>
                                    <p className="text-base font-hkgb text-gray-900">
                                        {order.paymentMethod}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">
                                        Payment Status
                                    </p>
                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full border border-green-200">
                                        {order.paymentStatus}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-hkgb text-gray-900 mb-4">
                                Order Actions
                            </h2>
                            <div className="space-y-3">
                                {/* Primary Actions */}
                                {order.status === "Delivered" && (
                                    <button className="w-full px-4 py-2.5 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors font-medium text-sm">
                                        Reorder All Items
                                    </button>
                                )}
                                {order.status === "Shipped" && (
                                    <button className="w-full px-4 py-2.5 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors font-medium text-sm">
                                        Track Order
                                    </button>
                                )}
                                {order.status === "Processing" && (
                                    <button className="w-full px-4 py-2.5 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors font-medium text-sm">
                                        Cancel Order
                                    </button>
                                )}

                                {/* Secondary Actions */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                        <Download className="w-4 h-4" />
                                        Invoice
                                    </button>
                                    <button className="flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                        <Printer className="w-4 h-4" />
                                        Print
                                    </button>
                                </div>

                                {/* Tertiary Actions */}
                                <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                    <HelpCircle className="w-4 h-4" />
                                    Need Help?
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function OrderDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return <OrderDetailsPageContent params={params} />;
}
