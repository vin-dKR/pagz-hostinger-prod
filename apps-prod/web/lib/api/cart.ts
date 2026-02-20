/**
 * Cart API functions
 */

import { get, post, put, del, ApiResponse } from '../api-client';

export type RuleType =
    | "BASE_PRICE"
    | "SPECIFICATION_COMBINATION"
    | "QUANTITY_TIER"
    | "ADDON";

export interface AddonRule {
    id: string;
    categoryId: string;
    ruleType: RuleType;
    basePrice?: number | null;
    priceModifier?: number | null;
    quantityMultiplier: boolean;
    minQuantity?: number | null;
    maxQuantity?: number | null;
}

export interface CartItemPricing {
    unitBasePrice: number;
    unitAddonPrice: number;
    baseTotal: number;
    addonTotal: number;
    total: number;
}

export interface CartItem {
    id: string;
    cartId: string;
    productId: string;
    variantId?: string | null;
    quantity: number;
    customDesignUrl?: string | string[]; // S3 URLs - can be array or string (backend stores as array)
    customText?: string | null;
    hasAddon?: boolean;
    addons?: AddonRule[];
    pricing?: CartItemPricing;
    metadata?: {
        pageCount?: number;
        copies?: number;
        selectedAddons?: string[];
        priceBreakdown?: Array<{ label: string; value: number }>;
    } | null;
    createdAt: string;
    updatedAt: string;
    product?: {
        id: string;
        name: string;
        basePrice: number;
        sellingPrice?: number | null;
        images?: Array<{ url: string; isPrimary: boolean }>;
    };
    variant?: {
        id: string;
        name: string;
        priceModifier: number;
    } | null;
}

export interface Cart {
    id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    items: CartItem[];
}

export interface CartResponse {
    cart: Cart;
    subtotal: number;
    baseSubtotal: number;
    addonsSubtotal: number;
    itemCount: number;
}

export interface AddToCartData {
    productId: string;
    variantId?: string;
    quantity?: number;
    customDesignUrl?: string | string[]; // S3 URLs - can be array or string
    customText?: string;
    hasAddon?: boolean;
    addons?: string[];
    metadata?: {
        pageCount?: number;
        copies?: number;
        selectedAddons?: string[];
        priceBreakdown?: Array<{ label: string; value: number }>;
    };
}

export interface UpdateCartItemData {
    quantity?: number;
    customDesignUrl?: string;
    customText?: string;
}

/**
 * Get user's cart
 */
export async function getCart(): Promise<ApiResponse<CartResponse>> {
    return get<CartResponse>('/cart');
}

/**
 * Add item to cart
 */
export async function addToCart(data: AddToCartData): Promise<ApiResponse<Cart>> {
    return post<Cart>('/cart/items', data);
}

/**
 * Update cart item
 */
export async function updateCartItem(
    itemId: string,
    data: UpdateCartItemData
): Promise<ApiResponse<Cart>> {
    return put<Cart>(`/cart/items/${itemId}`, data);
}

/**
 * Remove item from cart
 */
export async function removeFromCart(itemId: string): Promise<ApiResponse<Cart>> {
    return del<Cart>(`/cart/items/${itemId}`);
}

/**
 * Clear entire cart
 */
export async function clearCart(): Promise<ApiResponse<{ message: string }>> {
    return del<{ message: string }>('/cart/clear');
}

