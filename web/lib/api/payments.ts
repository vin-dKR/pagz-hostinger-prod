/**
 * Payments API functions
 *
 * The storefront talks to Razorpay exclusively. The PhonePe API surface
 * (createPhonePeOrder / verifyPhonePePayment) was removed when that
 * integration was retired — only Razorpay endpoints remain.
 */

import { post, type ApiResponse } from "../api-client";

export interface CreateRazorpayOrderRequest {
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

export interface CreateRazorpayOrderResponse {
    keyId: string;
    merchantOrderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
}

export interface VerifyRazorpayPaymentRequest {
    merchantOrderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}

export interface VerifyRazorpayPaymentResponse {
    verified: boolean;
    orderId?: string;
    state?: string;
    message?: string;
}

export async function createRazorpayOrder(
    data: CreateRazorpayOrderRequest,
): Promise<ApiResponse<CreateRazorpayOrderResponse>> {
    return post<CreateRazorpayOrderResponse>("/payment/razorpay/create-order-from-cart", data);
}

export async function verifyRazorpayPayment(
    data: VerifyRazorpayPaymentRequest,
): Promise<ApiResponse<VerifyRazorpayPaymentResponse>> {
    return post<VerifyRazorpayPaymentResponse>("/payment/razorpay/verify", data);
}
