/**
 * Orders Service
 * Handles order management operations
 */

import { get, patch, put, post } from './api-client';

export interface OrdersResponse {
    orders: Order[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface OrderItem {
    id?: string;
    productId: string;
    variantId?: string | null;
    quantity: number;
    price: number;
    customDesignUrl?: string[] | null; // Array of S3 URLs
    customDesignPresignedUrls?: string[] | null; // Array of presigned URLs for viewing private S3 files
    customDesignPresignedUrl?: string | null; // Legacy: single presigned URL (for backward compatibility)
    customText?: string | null;
    addons?: Array<{
        id: string;
        categoryId: string;
        ruleType: 'BASE_PRICE' | 'SPECIFICATION_COMBINATION' | 'QUANTITY_TIER' | 'ADDON';
        basePrice?: number | null;
        priceModifier?: number | null;
        quantityMultiplier: boolean;
        minQuantity?: number | null;
        maxQuantity?: number | null;
    }> | null;
    product?: {
        id: string;
        name: string;
        sku?: string | null;
        images?: Array<{ url: string; isPrimary: boolean }>;
        category?: {
            id: string;
            name: string;
        };
    };
    variant?: {
        id: string;
        name: string;
    } | null;
    metadata?: {
        pageCount?: number;
        copies?: number;
        selectedAddons?: string[];
        priceBreakdown?: Array<{
            label: string;
            value: number;
        }>;
    } | null;
}

export interface Order {
    id: string;
    userId: string;
    addressId: string;
    items: OrderItem[];
    subtotal?: number | null;
    discountAmount?: number | null;
    shippingCharges?: number | null;
    total: number;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    razorpayOrderId?: string | null;
    couponId?: string | null;
    address: Address;
    shippingAddress?: Address; // Alias for address for backward compatibility
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        email: string;
        name?: string | null;
        phone?: string | null;
    };
    payments?: Payment[];
    statusHistory?: OrderStatusHistory[];
}

export type OrderStatus =
    | 'PENDING_REVIEW'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED'

export type PaymentMethod = 'ONLINE' | 'OFFLINE';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface OrderStatusHistory {
    id: string;
    orderId: string;
    status: OrderStatus;
    comment?: string | null;
    createdAt: string;
}

export interface Payment {
    id: string;
    orderId: string;
    userId: string;
    amount: number;
    discountAmount?: number | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    status: PaymentStatus;
    method: PaymentMethod;
    couponId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

export interface UpdateOrderStatusData {
    status: OrderStatus;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: PaginationMeta;
}

export interface OrderQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: OrderStatus | OrderStatus[]; // Support multi-select
    paymentStatus?: PaymentStatus | PaymentStatus[];
    paymentMethod?: PaymentMethod;
    dateFrom?: string;
    dateTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    minAmount?: number;
    maxAmount?: number;
    customerId?: string;
    productId?: string;
    couponId?: string;
    sortBy?: 'createdAt' | 'total' | 'status' | 'paymentStatus' | 'customerName' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}

/**
 * Get all orders (admin) with pagination and search
 */
export async function getOrders(
    params?: OrderQueryParams
): Promise<PaginatedResponse<Order>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    // Handle status (array or single)
    if (params?.status) {
        if (Array.isArray(params.status)) {
            params.status.forEach(s => queryParams.append('status', s));
        } else {
            queryParams.append('status', params.status);
        }
    }

    // Handle paymentStatus (array or single)
    if (params?.paymentStatus) {
        if (Array.isArray(params.paymentStatus)) {
            params.paymentStatus.forEach(s => queryParams.append('paymentStatus', s));
        } else {
            queryParams.append('paymentStatus', params.paymentStatus);
        }
    }

    if (params?.paymentMethod) queryParams.append('paymentMethod', params.paymentMethod);
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params?.updatedFrom) queryParams.append('updatedFrom', params.updatedFrom);
    if (params?.updatedTo) queryParams.append('updatedTo', params.updatedTo);
    if (params?.minAmount) queryParams.append('minAmount', params.minAmount.toString());
    if (params?.maxAmount) queryParams.append('maxAmount', params.maxAmount.toString());
    if (params?.customerId) queryParams.append('customerId', params.customerId);
    if (params?.productId) queryParams.append('productId', params.productId);
    if (params?.couponId) queryParams.append('couponId', params.couponId);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/admin/orders${queryString ? `?${queryString}` : ''}`;

    const response = await get<OrdersResponse>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch orders');
    }

    return {
        items: response.data.orders,
        pagination: response.data.pagination,
    };
}

/**
 * Get single order by ID (admin)
 */
export async function getOrder(id: string): Promise<Order> {
    const response = await get<Order>(`/admin/orders/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch order');
    }

    return response.data;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
    id: string,
    data: UpdateOrderStatusData & { comment?: string; notifyCustomer?: boolean }
): Promise<Order> {
    const response = await patch<Order>(`/admin/orders/${id}/status`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update order status');
    }

    return response.data;
}

/**
 * Update order
 */
export async function updateOrder(
    id: string,
    data: {
        addressId?: string;
        shippingCharges?: number;
        discountAmount?: number;
        items?: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
            customDesignUrl?: string;
            customText?: string;
        }>;
    }
): Promise<Order> {
    const response = await put<Order>(`/admin/orders/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update order');
    }

    return response.data;
}

/**
 * Cancel order
 */
export async function cancelOrder(
    id: string,
    data: { reason: string; refund?: boolean }
): Promise<Order> {
    const response = await post<Order>(`/admin/orders/${id}/cancel`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to cancel order');
    }

    return response.data;
}

/**
 * Get order statistics
 */
export interface OrderStatistics {
    totalOrders: number;
    orders: {
        today: number;
        week: number;
        month: number;
    };
    totalRevenue: number;
    revenue: {
        today: number;
        week: number;
        month: number;
    };
    ordersByStatus: Array<{
        status: OrderStatus;
        count: number;
    }>;
    pendingPaymentsCount: number;
    averageOrderValue: number;
    ordersRequiringAttention: number;
}

export async function getOrderStatistics(params?: {
    dateFrom?: string;
    dateTo?: string;
}): Promise<OrderStatistics> {
    const queryParams = new URLSearchParams();
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo);

    const queryString = queryParams.toString();
    const endpoint = `/admin/orders/statistics${queryString ? `?${queryString}` : ''}`;

    const response = await get<OrderStatistics>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch order statistics');
    }

    return response.data;
}

/**
 * Mark payment as paid
 */
export async function markPaymentAsPaid(
    orderId: string,
    data: {
        amount?: number;
        reference?: string;
        date?: string;
    }
): Promise<Order> {
    const response = await post<Order>(`/admin/orders/${orderId}/payment/mark-paid`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to mark payment as paid');
    }

    return response.data;
}

/**
 * Process refund
 */
export async function processRefund(
    orderId: string,
    data: {
        amount?: number;
        reason: string;
        method?: string;
    }
): Promise<Order> {
    const response = await post<Order>(`/admin/orders/${orderId}/payment/refund`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to process refund');
    }

    return response.data;
}

/**
 * Get payment details
 */
export interface PaymentDetails {
    orderId: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    payments: Payment[];
    total: number;
}

export async function getPaymentDetails(orderId: string): Promise<PaymentDetails> {
    const response = await get<PaymentDetails>(`/admin/orders/${orderId}/payment`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch payment details');
    }

    return response.data;
}

/**
 * Update tracking
 */
export async function updateTracking(
    orderId: string,
    data: {
        trackingNumber: string;
        carrier?: string;
        shippingDate?: string;
    }
): Promise<Order> {
    const response = await patch<Order>(`/admin/orders/${orderId}/tracking`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update tracking');
    }

    return response.data;
}

/**
 * Mark as shipped
 */
export async function markAsShipped(
    orderId: string,
    data: {
        trackingNumber: string;
        carrier?: string;
        shippingDate?: string;
    }
): Promise<Order> {
    const response = await post<Order>(`/admin/orders/${orderId}/ship`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to mark as shipped');
    }

    return response.data;
}

/**
 * Mark as delivered
 */
export async function markAsDelivered(
    orderId: string,
    data: {
        deliveryDate?: string;
        notes?: string;
    }
): Promise<Order> {
    const response = await post<Order>(`/admin/orders/${orderId}/deliver`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to mark as delivered');
    }

    return response.data;
}

/**
 * Get order invoice (returns HTML)
 */
export async function getOrderInvoice(orderId: string): Promise<string> {
    const endpoint = `/admin/orders/${orderId}/invoice`;
    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1'}${endpoint}`;

    const response = await fetch(
        fullUrl,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error('Failed to fetch invoice');
    }

    return response.text();
}

/**
 * Export orders
 */
export async function exportOrders(
    params?: OrderQueryParams & { format?: 'csv' | 'json' }
): Promise<void> {
    const queryParams = new URLSearchParams();

    if (params?.status) {
        if (Array.isArray(params.status)) {
            params.status.forEach(s => queryParams.append('status', s));
        } else {
            queryParams.append('status', params.status);
        }
    }

    if (params?.paymentStatus) {
        if (Array.isArray(params.paymentStatus)) {
            params.paymentStatus.forEach(s => queryParams.append('paymentStatus', s));
        } else {
            queryParams.append('paymentStatus', params.paymentStatus);
        }
    }

    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params?.format) queryParams.append('format', params.format);

    const queryString = queryParams.toString();
    const endpoint = `/admin/orders/export${queryString ? `?${queryString}` : ''}`;

    const token = getAuthToken();
    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1'}${endpoint}`;

    const response = await fetch(
        fullUrl,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error('Failed to export orders');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `orders-export-${new Date().toISOString().split('T')[0]}.${params?.format || 'csv'}`;
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
        }
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Helper function to get auth token (from api-client)
function getAuthToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('admin_token='));

    if (!tokenCookie) {
        return null;
    }

    return tokenCookie.split('=')[1]?.trim() || null;
}

