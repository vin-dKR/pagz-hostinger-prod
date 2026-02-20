"use client";

import Link from "next/link";
import Image from "next/image";
import { imageLoader } from "@/lib/utils/image-loader";
import { useState, useMemo } from "react";
import { Package, Search, Filter } from "lucide-react";
import { useOrders, displayStatusMap } from "@/hooks/orders/useOrders";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { OrderStatus } from "@/lib/api/orders";

const statusColors: Record<string, string> = {
    'Delivered': "bg-green-100 text-green-700 border border-green-200",
    'Shipped': "bg-blue-100 text-blue-700 border border-blue-200",
    'Processing': "bg-yellow-100 text-yellow-700 border border-yellow-200",
    'Pending': "bg-gray-100 text-gray-700 border border-gray-200",
    'Accepted': "bg-blue-100 text-blue-700 border border-blue-200",
    'Cancelled': "bg-red-100 text-red-700 border border-red-200",
    'Rejected': "bg-red-100 text-red-700 border border-red-200",
};

// Filter options with display statuses
const filterOptions = [
    { value: "all", label: "All Orders" },
    { value: "Delivered", label: "Delivered" },
    { value: "Shipped", label: "Shipped" },
    { value: "Processing", label: "Processing" },
    { value: "Cancelled", label: "Cancelled" },
];

function OrdersPageContent() {
    const { orders, loading, error, searchOrders } = useOrders();
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const filteredOrders = useMemo(() => {
        return searchOrders(searchQuery, filterStatus);
    }, [searchQuery, filterStatus, searchOrders]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center py-12">
                <BarsSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1">
                <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <Package className="text-red-600 w-8 h-8" />
                    </div>
                    <p className="text-lg font-hkgb text-gray-900 mb-2">Error loading orders</p>
                    <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                        {error}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors font-hkgb text-sm"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Main Content */}
            <div className="flex-1">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-hkgb text-gray-900 mb-2">
                                My Orders
                            </h1>
                            <p className="text-gray-600 text-sm sm:text-base">
                                View and track all your orders in one place
                            </p>
                        </div>

                        {/* Search and Filter Section */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Search Input */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Search by order ID or product name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm"
                                    />
                                </div>

                                {/* Filter Button (Mobile) */}
                                <div className="sm:hidden">
                                    <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                                        <Filter size={18} />
                                        Filter
                                    </button>
                                </div>
                            </div>

                            {/* Filter Tabs - Desktop */}
                            <div className="hidden sm:flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                        {filterOptions.map((option) => (
                                        <button
                                key={option.value}
                                onClick={() => setFilterStatus(option.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === option.value
                                                ? "bg-[#008ECC] text-white border border-[#008ECC]"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                                                }`}
                                        >
                                {option.label}
                                        </button>
                        ))}
                            </div>

                            {/* Filter Tabs - Mobile Scrollable */}
                            <div className="sm:hidden mt-4 pt-4 border-t border-gray-100">
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {filterOptions.map((option) => (
                                            <button
                                    key={option.value}
                                    onClick={() => setFilterStatus(option.value)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 ${filterStatus === option.value
                                                    ? "bg-[#008ECC] text-white border border-[#008ECC]"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                                                    }`}
                                            >
                                    {option.value === "all" ? "All" : option.label}
                                            </button>
                            ))}
                                </div>
                            </div>
                        </div>

                        {/* Orders Count */}
                        <div className="mb-4">
                            <p className="text-sm text-gray-600">
                                Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {/* Orders List */}
                        <div className="space-y-4 sm:space-y-6">
                            {filteredOrders.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Package className="text-gray-400 w-8 h-8" />
                                    </div>
                                    <p className="text-lg font-hkgb text-gray-900 mb-2">No orders found</p>
                                    <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                                        {searchQuery
                                            ? `No orders found for "${searchQuery}"`
                                            : filterStatus === "all"
                                                ? "You haven't placed any orders yet"
                                                : `No ${filterStatus.toLowerCase()} orders`}
                                    </p>
                                    <Link
                                        href="/products"
                                        className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors font-hkgb text-sm"
                                    >
                                        Start Shopping
                                    </Link>
                                </div>
                            ) : (
                                filteredOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 hover:shadow-md transition-all duration-300"
                                    >
                                        {/* Order Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                                                    <h3 className="text-lg font-hkgb text-gray-900 truncate">
                                                        {order.orderNumber}
                                                    </h3>
                                                    <span
                                                className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.displayStatus] || statusColors['Pending']
                                                            }`}
                                                    >
                                                {order.displayStatus}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                                                    <p className="text-gray-600">
                                                        Placed on {order.date}
                                                    </p>
                                                    <span className="hidden sm:block text-gray-300">•</span>
                                                    <p className="text-gray-600">
                                                        {order.items.length} item{order.items.length > 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg sm:text-xl font-hkgb text-gray-900">
                                                    ₹{(Number(order.total)).toFixed(2)}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Total Amount
                                                </p>
                                            </div>
                                        </div>

                                        {/* Order Items */}
                                        <div className="space-y-3 mb-4">
                                    {order.items.map((item) => (
                                                <div
                                            key={item.id}
                                                    className="flex items-center gap-3 sm:gap-4 p-3 bg-gray-50 rounded-xl"
                                                >
                                                    {/* Item Image */}
                                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
                                                {item.image ? (
                                                    <Image
                                                        src={item.image}
                                                        alt={item.name}
                                                        fill
                                                        className="object-cover"
                                                        sizes="(max-width: 640px) 56px, 64px"
                                                        loader={imageLoader}
                                                    />
                                                ) : (
                                                        <Package className="text-gray-400 w-6 h-6 sm:w-7 sm:h-7" />
                                                )}
                                                    </div>

                                                    {/* Item Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                            {item.name}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <p className="text-xs text-gray-600">
                                                                Qty: {item.quantity}
                                                            </p>
                                                            <span className="text-gray-300">•</span>
                                                            <p className="text-xs text-gray-600">
                                                                ₹{(Number(item.price)).toFixed(2)} each
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Item Price */}
                                                    <div className="text-right">
                                                        <p className="text-sm font-hkgb text-gray-900">
                                                            ₹{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Subtotal
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Order Actions */}
                                        <div className="flex flex-wrap gap-2 sm:gap-3 pt-4 border-t border-gray-100">
                                            <Link
                                                href={`/orders/${order.id}`}
                                                className="flex-1 sm:flex-initial px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-center"
                                            >
                                                View Details
                                            </Link>

                                    {order.displayStatus === "Delivered" && (
                                                <button className="flex-1 sm:flex-initial px-4 py-2.5 border border-[#008ECC] text-[#008ECC] rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">
                                                    Reorder
                                                </button>
                                            )}

                                    {order.displayStatus === "Shipped" && (
                                                <Link
                                                    href={`/orders/${order.id}/track`}
                                                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors text-sm font-medium text-center"
                                                >
                                                    Track Order
                                                </Link>
                                            )}

                                    {order.displayStatus === "Processing" && (
                                                <button className="flex-1 sm:flex-initial px-4 py-2.5 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium">
                                                    Cancel Order
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Load More Button (if pagination needed) */}
                        {filteredOrders.length > 0 && (
                            <div className="mt-8 text-center">
                                <button className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                    Load More Orders
                                </button>
                            </div>
                        )}
            </div>
        </>
    );
}

export default function OrdersPage() {
    return <OrdersPageContent />;
}
