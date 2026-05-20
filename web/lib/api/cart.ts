/**
 * Cart API functions
 */

import { get, post, put, del, ApiResponse } from '../api-client';

/**
 * Per-uploaded-file metadata captured at add-to-cart time (Phase 0 of the
 * per-file addon pricing rollout — see
 * `prompts/per-file-addon-pricing-architecture.md` §3.1).
 *
 * `url` matches the corresponding entry in `customDesignUrl` (relative FTP
 * path); `pageCount` is the raw page count counted client-side at upload
 * (pdfjs). Server re-verifies in Phase 4.
 *
 * Exported as a shared shape so the services page, pending-purchase guest
 * payload, post-login merge, and cart API client all use the same type.
 */
export interface FileMeta {
    url: string;
    pageCount: number;
}

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
    /** One charge per physical copy (e.g. binding). */
    copyMultiplier?: boolean;
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
        /** Phase 0 — per-file metadata. Optional; rows written before this
         *  rollout lack the field and the engine falls back to aggregate. */
        files?: FileMeta[];
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
        /** Phase 0 — per-file `{ url, pageCount }` captured at add-to-cart
         *  time. Server persists into `CartItem.metadata.files` (sanitised).
         *  Omit when no files are attached. */
        files?: FileMeta[];
        /** User-selected spec values (slug → option value). Server uses
         *  this to re-derive half-page authoritatively. */
        specifications?: Record<string, any>;
        /** Half-page snapshot fields — display-only on cart UI; server
         *  re-derives from `specifications` for pricing. */
        effectivePageCount?: number;
        originalPageCount?: number;
        hasHalfPageAdjustment?: boolean;
        /** Password info for protected PDFs. */
        fileHasPassword?: boolean;
        filePassword?: string;
        filePasswords?: string[];
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

// ─── File verification (issue #56 retroactive sweep) ─────────────────────────

/**
 * Why files can be invalid:
 *  - `missing`    — the FTP server reports the file does not exist.
 *  - `empty`      — the file exists but has size 0 (the original #56 bug).
 *  - `unreadable` — the FTP server returned an error we can't classify.
 */
export type VerifyFileReason = 'missing' | 'empty' | 'unreadable';

export interface VerifyFileInvalidEntry {
    /** The same string the caller passed in (relative path or full URL). */
    path: string;
    reason: VerifyFileReason;
}

export interface VerifyCartFilesResponse {
    valid: string[];
    invalid: VerifyFileInvalidEntry[];
}

/**
 * Verify that every uploaded design file referenced by the cart still
 * exists on the FTP server with size > 0. Used by both the cart page
 * (on-mount sweep) and the checkout page (pre-payment guard).
 *
 * Centralised here so the two pages call one helper — keep all
 * client-side `customDesignUrl` verification logic out of components.
 *
 * Accepts mixed full-URL and relative-path inputs (`extractFtpPathFromUrl`
 * runs server-side). Returns `{ valid, invalid }` with the original input
 * strings preserved so callers can match `invalid.path` back to the cart
 * row that owns it.
 */
export async function verifyCartFiles(
    paths: string[],
): Promise<ApiResponse<VerifyCartFilesResponse>> {
    // Skip the round-trip when there's nothing to check.
    const clean = paths
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    if (clean.length === 0) {
        return { success: true, data: { valid: [], invalid: [] } };
    }
    return post<VerifyCartFilesResponse>('/cart/verify-files', { paths: clean });
}

