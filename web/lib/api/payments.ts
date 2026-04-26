/**
 * Payments API functions
 */

import { post, type ApiResponse } from "../api-client";

export interface CreatePhonePeOrderRequest {
    items: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        customDesignUrl?: string;
        customText?: string;
        addons?: string[];
        hasAddon?: boolean;
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
    shippingMethodId?: string | null;
    /** Optional free-form note from the customer at checkout. Server
     *  trims + caps at 2000 chars and persists on Order.customerComment. */
    customerComment?: string;
}

export interface CreatePhonePeOrderResponse {
    redirectUrl: string;
    merchantOrderId: string;
}

export interface CreateRazorpayOrderResponse {
    keyId: string;
    merchantOrderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
}

export interface VerifyPhonePePaymentRequest {
    merchantOrderId: string;
}

export interface VerifyPhonePePaymentResponse {
    verified: boolean;
    orderId?: string;
    state?: string;
    message?: string;
}

export interface VerifyRazorpayPaymentRequest {
    merchantOrderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}

/**
 * Create a PhonePe order from cart data (returns redirect URL)
 */
export async function createPhonePeOrder(
    data: CreatePhonePeOrderRequest
): Promise<ApiResponse<CreatePhonePeOrderResponse>> {
    return post<CreatePhonePeOrderResponse>("/payment/create-order-from-cart", data);
}

/**
 * Verify PhonePe payment after redirect back
 */
export async function verifyPhonePePayment(
    data: VerifyPhonePePaymentRequest
): Promise<ApiResponse<VerifyPhonePePaymentResponse>> {
    return post<VerifyPhonePePaymentResponse>("/payment/verify", data);
}

export async function createRazorpayOrder(
    data: CreatePhonePeOrderRequest
): Promise<ApiResponse<CreateRazorpayOrderResponse>> {
    return post<CreateRazorpayOrderResponse>("/payment/razorpay/create-order-from-cart", data);
}

export async function verifyRazorpayPayment(
    data: VerifyRazorpayPaymentRequest
): Promise<ApiResponse<VerifyPhonePePaymentResponse>> {
    return post<VerifyPhonePePaymentResponse>("/payment/razorpay/verify", data);
}
