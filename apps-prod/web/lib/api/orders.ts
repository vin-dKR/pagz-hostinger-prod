/**
 * Orders API functions
 */

import { get, post, uploadFile, ApiResponse } from '../api-client';

export type OrderStatus =
    | 'PENDING_REVIEW'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED';

export type PaymentMethod = 'ONLINE' | 'OFFLINE';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface OrderItemAddon {
    id: string;
    categoryId: string;
    ruleType: 'BASE_PRICE' | 'SPECIFICATION_COMBINATION' | 'QUANTITY_TIER' | 'ADDON';
    basePrice?: number | null;
    priceModifier?: number | null;
    quantityMultiplier: boolean;
    minQuantity?: number | null;
    maxQuantity?: number | null;
}

export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
    customDesignUrl?: string[]; // Array of S3 URLs
    customText?: string;
    createdAt: string;
    addons?: OrderItemAddon[];
    product?: {
        id: string;
        name: string;
        images?: Array<{ url: string }>;
    };
    variant?: {
        id: string;
        name: string;
    };
}

export interface OrderStatusHistory {
    id: string;
    orderId: string;
    status: OrderStatus;
    comment?: string;
    createdAt: string;
}

export interface Order {
    id: string;
    userId: string;
    addressId: string;
    subtotal?: number;
    discountAmount?: number;
    shippingCharges?: number;
    total: number;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    razorpayOrderId?: string;
    couponId?: string;
    createdAt: string;
    updatedAt: string;
    items: OrderItem[];
    address?: {
        id: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    statusHistory?: OrderStatusHistory[];
}

export interface CreateOrderData {
    items: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        customDesignUrl?: string[]; // Array of S3 URLs
        customText?: string;
    }>;
    addressId: string;
    paymentMethod: PaymentMethod;
    couponCode?: string;
}

export interface OrdersResponse {
    orders: Order[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Get user's orders
 */
export async function getMyOrders(): Promise<ApiResponse<OrdersResponse>> {
    return get<OrdersResponse>('/customer/orders');
}

/**
 * Get single order by ID
 */
export async function getOrder(id: string): Promise<ApiResponse<Order>> {
    return get<Order>(`/customer/orders/${id}`);
}

/**
 * Create new order
 */
export async function createOrder(data: CreateOrderData): Promise<ApiResponse<Order>> {
    return post<Order>('/customer/orders', data);
}

/**
 * Upload files for order after order confirmation
 * This is called after payment success to upload files to S3 and update order items
 */
export async function uploadOrderFiles(
    orderId: string,
    files: File[],
    orderItemId?: string,
    productId?: string,
    variantId?: string
): Promise<ApiResponse<{ uploadedFiles: Array<{ key: string; filename: string; size: number; mimetype: string }>; updatedItems?: Array<{ orderItemId: string; productId: string; variantId: string | null; s3Key: string | string[]; s3Urls: string[] }>; uploadedFilesCount: number }>> {
    const additionalData: Record<string, string> = {};
    if (orderItemId) {
        additionalData.orderItemId = orderItemId;
    }
    if (productId) {
        additionalData.productId = productId;
    }
    if (variantId) {
        additionalData.variantId = variantId;
    }

    return await uploadFile<{ uploadedFiles: Array<{ key: string; filename: string; size: number; mimetype: string }>; updatedItems?: Array<{ orderItemId: string; productId: string; variantId: string | null; s3Key: string | string[]; s3Urls: string[] }>; uploadedFilesCount: number }>(
        `/upload/order/${orderId}/files`,
        files,
        additionalData
    );
}
