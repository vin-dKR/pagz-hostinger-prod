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

export interface CartItemAddonPricing {
    ruleId: string;
    /** Pre-formatted "key: value, …" label built from the rule's
     *  `specificationValues`. Mirrors the legacy client-side `getAddonLabel`. */
    name: string;
    total: number;
    /** Phase 2 — per-file price breakdown surfaced by the cart endpoint.
     *  One entry per uploaded file for `perFileEvaluation` rules; one
     *  synthetic aggregate entry (`fileUrl: null`) for legacy / non
     *  per-file rules. UI renders uniformly without branching on the
     *  rule shape. See `AddonBreakdownEntry`. */
    breakdown: AddonBreakdownEntry[];
    /** Rule's page range — used by the UI to disambiguate two addons
     *  that share the same spec-derived `name` (e.g. two "wiro binding"
     *  tiers in different page ranges). */
    range?: { min: number | null; max: number | null };
}

export interface CartItemPricing {
    unitBasePrice: number;
    unitAddonPrice: number;
    baseTotal: number;
    addonTotal: number;
    total: number;
    /** Per-addon totals (one entry per addon rule that survived spec-group
     *  dominance). Added in Phase 1 of the per-file addon pricing rollout
     *  so the UI never reimplements the engine math. Empty for items
     *  without addons. */
    addons?: CartItemAddonPricing[];
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

// ─── Calculate-pricing (Phase 1 of per-file addon pricing) ───────────────────
// Spec: `prompts/per-file-addon-pricing-architecture.md` §2 Phase 1.
// Public endpoint — works for guests on `/services/<slug>`. The api is the
// single source of truth for pricing; web/admin never reimplement the math.

export interface CalculatePricingFileInput {
    /** Relative FTP path or full https URL — the same string stored in
     *  `CartItem.customDesignUrl[i]` and `metadata.files[i].url`. */
    url: string;
    /** Raw page count counted client-side at upload (pdfjs). Must be > 0. */
    pageCount: number;
}

export interface CalculatePricingRequest {
    categoryId: string;
    selectedSpecifications: Record<string, string>;
    /** Pricing-rule ids of type ADDON. Unknown ids are silently dropped on
     *  the server (rule may have been deleted mid-session). */
    selectedAddons: string[];
    files?: CalculatePricingFileInput[];
    copies: number;
    /** Optional explicit half-page flag. When omitted the server derives
     *  it from `selectedSpecifications` (an option flagged `isHalfPage`). */
    side?: 'one' | 'both';
}

/**
 * Phase 2 — per-file price breakdown surfaced on each addon entry. One
 * entry per uploaded file for `perFileEvaluation` addons; one synthetic
 * aggregate entry (`fileUrl: null`) for legacy / non-per-file addons.
 * UI can render uniformly without branching on the rule shape.
 */
export interface AddonBreakdownEntry {
    /** Relative FTP path / URL of the file this entry priced.
     *  `null` for the aggregate fallback (no per-file evaluation). */
    fileUrl: string | null;
    pageCount: number;
    effectivePages: number;
    price: number;
}

export interface CalculatePricingAddon {
    ruleId: string;
    name: string;
    total: number;
    /** Phase 2 — always populated. See `AddonBreakdownEntry`. */
    breakdown: AddonBreakdownEntry[];
    /** Rule page-range tier — UI uses it to disambiguate addons that
     *  share the same `name` but cover different tiers. */
    range?: { min: number | null; max: number | null };
}

export interface CalculatePricingResponse {
    baseSubtotal: number;
    addonsSubtotal: number;
    total: number;
    addons: CalculatePricingAddon[];
    pageCount: number;
    effectivePageCount?: number;
    hasHalfPageAdjustment: boolean;
}

/**
 * Optional surface tag passed via the `x-pagz-source` header so prod logs
 * can correlate two pricing calls coming from different UIs (services
 * page vs guest cart vs cart preview). Added for issue #93 to debug the
 * guest-cart base/addon split mismatch.
 */
export type CalculatePricingSource =
    | 'services-page'
    | 'guest-cart'
    | 'cart'
    | 'checkout'
    | 'unknown';

/**
 * Ask the API to compute base + addon totals for a service configuration.
 * Used by the services page live price card, cart preview, and checkout
 * summary. Public — works for guest sessions.
 */
export async function calculatePricing(
    input: CalculatePricingRequest,
    source: CalculatePricingSource = 'unknown',
): Promise<ApiResponse<CalculatePricingResponse>> {
    return post<CalculatePricingResponse>(
        '/cart/calculate-pricing',
        input,
        { 'x-pagz-source': source },
    );
}

