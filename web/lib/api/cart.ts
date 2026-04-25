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
    specificationValues?: Record<string, any>;
    basePrice?: number | null;
    priceModifier?: number | null;
    quantityMultiplier: boolean;
    fileMultiplier?: boolean;
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
        templateId?: string;
        templateName?: string;
        templatePreviewImage?: string;
        templateFormData?: Record<string, any>;
        templateFormImages?: string[];
        /** User-selected spec values (slug → option value). Server uses this
         *  to re-derive half-page authoritatively. */
        specifications?: Record<string, any>;
        // Half-page ("Both Sides") reduction state, written by the cart
        // controller after pricing. Display-only — server re-derives from
        // `specifications` for math.
        effectivePageCount?: number;
        originalPageCount?: number;
        hasHalfPageAdjustment?: boolean;
    } | null;
    createdAt: string;
    updatedAt: string;
    product?: {
        id: string;
        name: string;
        basePrice: number;
        sellingPrice?: number | null;
        images?: Array<{ url: string; isPrimary: boolean }>;
        category?: {
            id: string;
            name: string;
            slug: string;
            /**
             * Minimum cart subtotal (₹) required for items in this category
             * for the order to be allowed. Null or 0 means no minimum.
             */
            minCartValue?: number | string | null;
        } | null;
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
        templateId?: string;
        templateName?: string;
        templatePreviewImage?: string;
        templateFormData?: Record<string, any>;
        templateFormImages?: string[];
    };
}

export interface UpdateCartItemData {
    quantity?: number;
    customDesignUrl?: string | string[];
    customText?: string;
    /**
     * Explicit addon ids to set on the cart item. Omit to preserve existing
     * addons. Pass [] to clear them.
     */
    addons?: string[];
    hasAddon?: boolean;
    metadata?: CartItem["metadata"];
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

export interface CategoryCartShortfall {
    categoryId: string;
    categoryName: string;
    required: number;
    current: number;
}

export interface ValidateCartMinimumsResponse {
    ok: boolean;
    shortfalls: CategoryCartShortfall[];
}

/**
 * Preflight check: ask the API whether the selected cart items satisfy each
 * category's `minCartValue`. Pass `itemIds` to limit the check to the items
 * the user has actually selected on the cart page.
 */
export async function validateCartMinimums(
    itemIds?: string[],
): Promise<ApiResponse<ValidateCartMinimumsResponse>> {
    return post<ValidateCartMinimumsResponse>('/cart/validate-minimums', {
        itemIds: itemIds && itemIds.length > 0 ? itemIds : undefined,
    });
}

