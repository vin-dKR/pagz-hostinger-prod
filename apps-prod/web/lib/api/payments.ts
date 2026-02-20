/**
 * Payments API functions (Razorpay)
 */

import { post, type ApiResponse } from "../api-client";

export interface CreateRazorpayOrderRequest {
    orderId: string;
    amount: number;
}

export interface CreateRazorpayOrderFromCartRequest {
    items: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        customDesignUrl?: string;
        customText?: string;
        metadata?: {
            pageCount?: number;
            copies?: number;
            selectedAddons?: string[];
            priceBreakdown?: Array<{
                label: string;
                value: number;
            }>;
        };
    }>;
    addressId: string;
    amount: number;
    couponCode?: string;
    shippingCharges?: number;
}

export interface CreateRazorpayOrderResponse {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    key?: string;
}

export interface VerifyRazorpayPaymentRequest {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export interface VerifyRazorpayPaymentResponse {
    verified: boolean;
    orderId: string;
    paymentId: string;
}

/**
 * Create a Razorpay order for an existing backend order (legacy)
 */
export async function createRazorpayOrder(
    data: CreateRazorpayOrderRequest
): Promise<ApiResponse<CreateRazorpayOrderResponse>> {
    return post<CreateRazorpayOrderResponse>("/payment/create-order", data);
}

/**
 * Create a Razorpay order directly from cart data
 * Order will be created in DB only after successful payment verification
 */
export async function createRazorpayOrderFromCart(
    data: CreateRazorpayOrderFromCartRequest
): Promise<ApiResponse<CreateRazorpayOrderResponse>> {
    return post<CreateRazorpayOrderResponse>("/payment/create-order-from-cart", data);
}

/**
 * Verify Razorpay payment after successful checkout
 */
export async function verifyRazorpayPayment(
    data: VerifyRazorpayPaymentRequest
): Promise<ApiResponse<VerifyRazorpayPaymentResponse>> {
    return post<VerifyRazorpayPaymentResponse>("/payment/verify", data);
}


