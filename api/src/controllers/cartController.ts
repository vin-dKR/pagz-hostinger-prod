import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { AppError, ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { calculateProductEffectivePages, getProductHalfPageBreakdown } from "../utils/product-half-page.js";
import { deriveHalfPageFromSelectedSpecs } from "../utils/half-page-from-specs.js";
import { deleteFromFTP, extractFtpPathFromUrl, verifyFTPFiles } from "../services/ftp.js";
import { partitionDeletableFtpPaths } from "../utils/ftp-reference.js";
import { getParamAsString } from "../utils/db-utils.js";
import {
    computeAddonBreakdown,
    computeAddonLineTotal,
    computeLineAddonsTotal,
    fetchAddonRuleMap,
    fetchAddonSpecMap,
    getAddonUnitPrice,
    normalizeAddonIds,
    resolveActiveAddons,
    sanitizePricingFiles,
    warnPerFileFallback,
    type AddonBreakdownEntry,
    type AddonPricingRule,
    type PricingFileMeta,
} from "../utils/addon-pricing.js";
import { computeCategoryCartShortfalls } from "../utils/category-min-cart-value.js";
import { processHalfPageCalculation } from "../utils/half-page-calculation.js";

/**
 * Service-style products (issue #82) are published from a `CategoryPricingRule`
 * and carry `generatedFromPricingRule = true`. For those, the cart `quantity`
 * is `pageCount × copies` summed across all uploaded files — not a count of
 * orderable SKU units. Comparing that against `Product.stock` (an admin-set
 * SKU count, default 0) wrongly rejected legitimate multi-file orders with
 * "Insufficient stock", e.g. 1000p + 482p PDFs against a stock of 100.
 *
 * Stock semantics still apply to physical SKUs (`generatedFromPricingRule =
 * false`) and to any product `variant` (variants only exist on physical SKUs).
 */
const isStockTrackedProduct = (p: { generatedFromPricingRule?: boolean | null }): boolean =>
    p.generatedFromPricingRule !== true;

/**
 * Shape of the `addons` include used for cart reads. Centralised so the cart
 * GET response, the add-to-cart response, and any future read path stay in
 * sync and always surface the fields the UI needs for display/pricing.
 */
const CART_ADDON_SELECT = {
    id: true,
    categoryId: true,
    ruleType: true,
    specificationValues: true,
    basePrice: true,
    priceModifier: true,
    quantityMultiplier: true,
    fileMultiplier: true,
    copyMultiplier: true,
    perFileEvaluation: true,
    minQuantity: true,
    maxQuantity: true,
} as const;

/**
 * Phase 0 — per-file metadata capture.
 *
 * Take an incoming `metadata` blob from the client and return a new blob
 * with `files` re-derived from a sanitised view of the raw input:
 *   - if the client sent `metadata.files` (Phase 0+ clients), it gets
 *     validated + persisted as a clean `PricingFileMeta[]`.
 *   - if the client omitted `files` (legacy guest entries, third-party
 *     callers), the field is dropped entirely so we don't leave a stale
 *     array on an updated cart row. The engine continues to read the
 *     aggregate `pageCount`/`effectivePageCount` path for rows without
 *     `files`, so back-compat is preserved.
 *
 * Returns the value as-is when it isn't a plain object (preserves the
 * existing "pass-through" behavior for legacy / null / scalar inputs).
 * The return type is intentionally `any` so this slots into Prisma's
 * `InputJsonValue` slots without forcing every call site to cast.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPricingFilesToMetadata(incoming: unknown): any {
    if (incoming === null || incoming === undefined) return incoming;
    if (typeof incoming !== "object") return incoming;
    const base = { ...(incoming as Record<string, unknown>) };
    const sanitized: PricingFileMeta[] | undefined = sanitizePricingFiles(
        (incoming as { files?: unknown }).files,
    );
    if (sanitized && sanitized.length > 0) {
        base.files = sanitized;
    } else {
        // Drop a malformed/empty `files` so we never persist `files: []`
        // or a half-typed array — cleaner than leaving raw input on the row.
        delete base.files;
    }
    return base;
}

function normalizeDesignUrls(value: unknown): string[] {
    if (!value) return [];

    const rawValues: string[] = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : typeof value === "string"
            ? [value]
            : [];

    return rawValues
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
// Get user's cart
export const getCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        let cart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
            select: {
                id: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
                items: {
                    select: {
                        id: true,
                        cartId: true,
                        productId: true,
                        variantId: true,
                        quantity: true,
                        customDesignUrl: true,
                        customText: true,
                        hasAddon: true,
                        metadata: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                basePrice: true,
                                sellingPrice: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                        slug: true,
                                        image: true,
                                        images: {
                                            select: {
                                                id: true,
                                                url: true,
                                                alt: true,
                                                isPrimary: true,
                                                displayOrder: true,
                                            },
                                            orderBy: [
                                                { isPrimary: 'desc' },
                                                { displayOrder: 'asc' },
                                            ],
                                        },
                                    },
                                },
                                images: true,
                            },
                        },
                        variant: {
                            select: {
                                id: true,
                                name: true,
                                priceModifier: true,
                            },
                        },
                        addons: {
                            select: CART_ADDON_SELECT,
                        },
                    },
                },
            },
        });

        // Create cart if it doesn't exist
        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId: req.user.id },
                select: {
                    id: true,
                    userId: true,
                    createdAt: true,
                    updatedAt: true,
                    items: {
                        select: {
                            id: true,
                            cartId: true,
                            productId: true,
                            variantId: true,
                            quantity: true,
                            customDesignUrl: true,
                            customText: true,
                            hasAddon: true,
                            metadata: true,
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    basePrice: true,
                                    sellingPrice: true,
                                    category: {
                                        select: {
                                            id: true,
                                            name: true,
                                            slug: true,
                                            image: true,
                                            minCartValue: true,
                                            images: {
                                                select: {
                                                    id: true,
                                                    url: true,
                                                    alt: true,
                                                    isPrimary: true,
                                                    displayOrder: true,
                                                },
                                                orderBy: [
                                                    { isPrimary: 'desc' },
                                                    { displayOrder: 'asc' },
                                                ],
                                            },
                                        },
                                    },
                                    images: true,
                                },
                            },
                            variant: {
                                select: {
                                    id: true,
                                    name: true,
                                    priceModifier: true,
                                },
                            },
                            addons: {
                                select: CART_ADDON_SELECT,
                            },
                        },
                    },
                },
            });
        }

        // Calculate totals
        let baseSubtotal = 0;
        let addonsSubtotal = 0;

        const cartItems = (cart as any).items as any[];

        const itemsWithPricing = await Promise.all(cartItems.map(async (item) => {
            const productBasePrice = Number(item.product.sellingPrice ?? item.product.basePrice);
            const variantPrice = item.variant ? Number(item.variant.priceModifier) : 0;
            const unitBasePrice = productBasePrice + variantPrice;

            // Get pageCount and copies from metadata
            const pageCount = (item.metadata as any)?.pageCount || null;
            const copies = (item.metadata as any)?.copies || 1;

            // Half-page detection. Authoritative source of truth, in order:
            //   1. user-selected specs against live category options
            //      (`metadata.specifications` + isHalfPage flag) — handles
            //      products published before the option's isHalfPage flag
            //      was set without trusting client-supplied numbers.
            //   2. ProductSpecification snapshot — kept as a legacy
            //      fallback for items written before metadata.specifications
            //      was persisted.
            // The reduced page count is ALWAYS computed as ceil(pageCount/2)
            // server-side. We never accept a client-supplied
            // `effectivePageCount` or `hasHalfPageAdjustment` value for
            // pricing — doing so would let an attacker spoof
            // effectivePageCount=1 on a 100-page job and pay ₹1.10 instead
            // of ₹110.
            const userSpecs = (item.metadata as any)?.specifications;
            const specsHalfPage = await deriveHalfPageFromSelectedSpecs(item.productId, userSpecs);

            let effectivePageCount: number;
            let effectiveQuantity: number;
            let hasHalfPage: boolean;
            if (specsHalfPage && pageCount && pageCount > 0) {
                effectivePageCount = Math.ceil(pageCount / 2);
                effectiveQuantity = effectivePageCount * (copies || 1);
                hasHalfPage = true;
            } else {
                ({ effectivePageCount, effectiveQuantity, hasHalfPage } = await calculateProductEffectivePages(
                    item.productId,
                    pageCount,
                    item.quantity,
                    copies
                ));
            }

            // Use effective page count for pricing if half-page is applied
            const effectivePages = pageCount && pageCount > 0
                ? (hasHalfPage ? effectivePageCount : pageCount) * copies
                : item.quantity;

            // If the product's base pricing rule is configured with
            // fileMultiplier, base price scales with the number of uploaded
            // files (customDesignUrl length). Mirrors the preview endpoint.
            const lineFileCount = normalizeDesignUrls(item.customDesignUrl).length;
            const baseRule = await prisma.categoryPricingRule.findFirst({
                where: {
                    productId: item.productId,
                    ruleType: { in: ["BASE_PRICE", "SPECIFICATION_COMBINATION"] },
                    isActive: true,
                },
                select: { fileMultiplier: true, quantityMultiplier: true },
            });
            const baseUsesFileMultiplier = Boolean((baseRule as { fileMultiplier?: boolean } | null)?.fileMultiplier);
            const safeFileCount = Math.max(1, lineFileCount);

            // Calculate base total:
            //   fileMultiplier on base rule -> unitBasePrice * fileCount
            //   else pageCount-based        -> unitBasePrice * effectivePages
            //   else                        -> unitBasePrice * quantity
            const baseTotal = baseUsesFileMultiplier
                ? unitBasePrice * safeFileCount
                : pageCount && pageCount > 0
                    ? unitBasePrice * effectivePages
                    : unitBasePrice * item.quantity;

            // Addon pricing gates on RAW upload volume (pageCount × copies),
            // independent of the half-page reduction applied to the base
            // price. A 50-page PDF × 10 copies = 500 pages of binding work
            // even when the print is duplexed onto 250 sheets.
            let addonUnitPrice = 0;
            let addonTotal = 0;
            // Phase 1 (per-file addon pricing) — surface per-addon totals so
            // the cart UI can render the addon row breakdown without
            // recomputing client-side. Each entry corresponds to one addon
            // rule that survived spec-group dominance.
            // Phase 2 — also surface the per-file breakdown so the cart UI
            // can show "file1: ₹50, file2: ₹50" for perFileEvaluation rules
            // without re-running the engine client-side.
            const addonLineDetails: Array<{
                ruleId: string;
                name: string;
                total: number;
                breakdown: AddonBreakdownEntry[];
                range?: { min: number | null; max: number | null };
            }> = [];

            if (item.addons && item.addons.length > 0) {
                const lineFileCount = normalizeDesignUrls(item.customDesignUrl).length;
                const itemAddons = item.addons as Array<AddonPricingRule & {
                    specificationValues?: Record<string, unknown> | null;
                }>;
                // Pull through the persisted per-file metadata + side hint
                // so the perFileEvaluation branch (Phase 2) can re-derive
                // each file's effective page count. `side` is inferred from
                // the half-page detection above when the writer didn't
                // persist it explicitly.
                const persistedFiles = sanitizePricingFiles(
                    (item.metadata as { files?: unknown } | null | undefined)?.files,
                );
                const persistedSide = (item.metadata as { side?: unknown } | null | undefined)?.side;
                const sideForMeta: "one" | "both" | undefined =
                    persistedSide === "one" || persistedSide === "both"
                        ? persistedSide
                        : hasHalfPage ? "both" : undefined;
                const pricingLine = {
                    quantity: item.quantity,
                    addons: itemAddons.map((a) => a.id),
                    metadata: {
                        pageCount: pageCount && pageCount > 0 ? pageCount : null,
                        copies,
                        // Pass-through for copyMultiplier addons — binding-style
                        // rules charge per book and check range against the
                        // post-half-page sheet count, not raw document pages.
                        effectivePageCount: hasHalfPage ? effectivePageCount : null,
                        files: persistedFiles,
                        side: sideForMeta,
                    },
                    fileCount: lineFileCount,
                };

                // Spec-group dominance — same-spec rules where one is
                // copyMultiplier=true suppress the others. Resolved here so
                // the cart preview total agrees with the order/invoice
                // path that runs the same util.
                const surviving = resolveActiveAddons(
                    itemAddons.map((rule) => ({ rule, specs: rule.specificationValues ?? null }))
                );
                const survivingIds = new Set(surviving.map((r) => r.id));

                // Single summary warn per cart item when any addon rule
                // forces the perFileEvaluation aggregate fallback because
                // the line predates Phase 0 (no `metadata.files` row).
                // Issue #77 — replaces N near-identical warnings emitted
                // from inside `computeAddonLineTotal`.
                warnPerFileFallback(
                    [pricingLine],
                    new Map(itemAddons.map((rule) => [rule.id, rule])),
                    { cartItemId: item.id, productId: item.productId },
                );
                for (const addon of itemAddons) {
                    addonUnitPrice += getAddonUnitPrice(addon);
                    if (!survivingIds.has(addon.id)) continue;
                    const addonLineTotal = computeAddonLineTotal(addon, pricingLine);
                    addonTotal += addonLineTotal;
                    const specs = (addon.specificationValues || {}) as Record<string, unknown>;
                    const entries = Object.entries(specs);
                    const name = entries.length > 0
                        ? entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ")
                        : "Addon";
                    addonLineDetails.push({
                        ruleId: addon.id,
                        name,
                        total: Number(addonLineTotal.toFixed(2)),
                        breakdown: computeAddonBreakdown(addon, pricingLine),
                        range: {
                            min: addon.minQuantity ?? null,
                            max: addon.maxQuantity ?? null,
                        },
                    });
                }
            }

            const total = baseTotal + addonTotal;

            baseSubtotal += baseTotal;
            addonsSubtotal += addonTotal;

            // Get half-page breakdown if applicable
            let halfPageBreakdown = null;
            if (pageCount && pageCount > 0) {
                halfPageBreakdown = await getProductHalfPageBreakdown(
                    item.productId,
                    pageCount,
                    item.quantity,
                    copies
                );
            }

            // Update metadata with half-page info if applicable. Dedupe the
            // half-page breakdown row by label prefix — getCart runs on every
            // cart fetch, so without dedupe the priceBreakdown grows by one
            // duplicate row each refresh and ends up rendered N times in the
            // order detail view (which copies metadata.priceBreakdown over).
            const halfPageLabelPrefix = "Both Side";
            const existingBreakdown = ((item.metadata as any)?.priceBreakdown || []).filter(
                (entry: { label?: string } | null | undefined) =>
                    !(entry?.label && String(entry.label).startsWith(halfPageLabelPrefix))
            );
            const updatedMetadata = {
                ...(item.metadata as any || {}),
                ...(hasHalfPage && {
                    effectivePageCount,
                    originalPageCount: pageCount,
                    hasHalfPageAdjustment: true,
                }),
                ...(halfPageBreakdown && {
                    priceBreakdown: [
                        ...existingBreakdown,
                        halfPageBreakdown,
                    ],
                }),
            };

            return {
                ...item,
                metadata: updatedMetadata,
                pricing: {
                    unitBasePrice,
                    unitAddonPrice: addonUnitPrice,
                    baseTotal,
                    addonTotal,
                    total,
                    // Phase 1 — per-addon totals so the cart UI can render
                    // its breakdown row without re-running the engine. Empty
                    // when the item has no addons.
                    addons: addonLineDetails,
                },
            };
        }));

        const subtotal = baseSubtotal + addonsSubtotal;

        return sendSuccess(res, {
            cart: {
                ...cart,
                items: itemsWithPricing,
            },
            subtotal,
            baseSubtotal,
            addonsSubtotal,
            itemCount: cartItems.length,
        });
    } catch (error) {
        next(error);
    }
};

// Add item to cart
export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { productId, variantId, quantity = 1, customDesignUrl, customText, hasAddon, addons } = req.body;
        // Sanitize metadata.files (Phase 0) before any pricing / persistence
        // step that consumes the blob. `applyPricingFilesToMetadata` is a
        // no-op for legacy clients that don't supply `files`.
        const metadata = req.body.metadata !== undefined
            ? applyPricingFilesToMetadata(req.body.metadata)
            : undefined;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }

        if (quantity < 1) {
            throw new ValidationError("Quantity must be at least 1");
        }

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { variants: true },
        });

        if (!product || !product.isActive) {
            throw new NotFoundError("Product not found");
        }

        // Check stock — only meaningful for physical SKUs. Service-style
        // products (print jobs) pass `quantity = pageCount × copies` which
        // is not comparable to `Product.stock`. See `isStockTrackedProduct`.
        if (isStockTrackedProduct(product) && product.stock < quantity) {
            throw new ValidationError("Insufficient stock");
        }

        // Verify variant if provided. Variants exist on physical SKUs, so
        // their stock check always applies when a variantId is supplied.
        if (variantId) {
            const variant = product.variants.find((v) => v.id === variantId);
            if (!variant || !variant.available) {
                throw new NotFoundError("Variant not found or unavailable");
            }
            if (variant.stock < quantity) {
                throw new ValidationError("Insufficient variant stock");
            }
        }

        // Get or create cart
        let cart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId: req.user.id },
            });
        }

        // Normalise incoming addon payload. When the client omits the field
        // entirely we leave any existing addons untouched; when the client
        // passes an explicit array (even []) we take it as the authoritative
        // new state for this line. This matches how users think about
        // "re-configure and add-to-cart again" vs "bump quantity".
        const addonsProvided = Array.isArray(addons);
        const rawAddonIds = addonsProvided ? normalizeAddonIds(addons) : [];

        // Filter to addon rules that actually exist + belong to the product's
        // category. Stale ids (common with the guest pending-cart flow when a
        // rule was deleted or its category changed between save and login)
        // would otherwise throw Prisma P2025 on `connect` and reject the
        // whole add-to-cart. Dropping bad ids lets the item land with the
        // surviving addons instead of silently producing an empty cart.
        let normalizedAddonIds = rawAddonIds;
        if (rawAddonIds.length > 0) {
            const liveRules = await prisma.categoryPricingRule.findMany({
                where: {
                    id: { in: rawAddonIds },
                    ruleType: "ADDON",
                    isActive: true,
                    categoryId: product.categoryId,
                },
                select: { id: true },
            });
            normalizedAddonIds = liveRules.map((r) => r.id);
            if (normalizedAddonIds.length !== rawAddonIds.length) {
                console.warn(
                    `[cart] dropped ${rawAddonIds.length - normalizedAddonIds.length}/${rawAddonIds.length} stale addon id(s) for product ${productId}`
                );
            }
        }

        // Check if item already exists in cart
        const existingItem = await prisma.cartItem.findUnique({
            where: {
                cartId_productId_variantId: {
                    cartId: cart.id,
                    productId,
                    variantId: variantId || "",
                },
            },
            include: {
                addons: { select: { id: true } },
            },
        });

        // Per-category minimum cart value gate.
        // Evaluates against the prospective order total for the category —
        // (base × qty × variant modifier) + addon contributions, matching the
        // same pricing rules that drive the cart subtotal, order creation,
        // and invoice. An add-to-cart attempt is rejected when the post-add
        // category total falls below the category's configured minimum.
        if (product.categoryId) {
            const category = await prisma.category.findUnique({
                where: { id: product.categoryId },
                select: { id: true, name: true, minCartValue: true },
            });

            const minValue = category?.minCartValue ? Number(category.minCartValue) : 0;
            if (category && minValue > 0) {
                const sameCategoryItems = await prisma.cartItem.findMany({
                    where: {
                        cartId: cart.id,
                        product: { categoryId: category.id },
                    },
                    include: {
                        product: { select: { basePrice: true } },
                        variant: { select: { priceModifier: true } },
                        addons: { select: CART_ADDON_SELECT },
                    },
                });

                let prospective = 0;
                for (const ci of sameCategoryItems) {
                    if (ci.id === existingItem?.id) continue;
                    const basePrice = Number(ci.product.basePrice);
                    const modifier = ci.variant ? Number(ci.variant.priceModifier) : 0;
                    const baseLine = (basePrice + modifier) * ci.quantity;

                    const fileCount = Array.isArray(ci.customDesignUrl)
                        ? (ci.customDesignUrl as unknown[]).length
                        : 0;
                    const addonMap = new Map(
                        ci.addons.map((a) => [a.id, a as AddonPricingRule]),
                    );
                    const addonSpecMap = new Map(
                        ci.addons.map((a) => [
                            a.id,
                            ((a as { specificationValues?: Record<string, unknown> | null }).specificationValues) ?? null,
                        ]),
                    );
                    const addonTotal = computeLineAddonsTotal(
                        {
                            quantity: ci.quantity,
                            addons: ci.addons.map((a) => a.id),
                            metadata: (ci as any).metadata ?? null,
                            fileCount,
                        },
                        addonMap,
                        addonSpecMap,
                    );

                    prospective += baseLine + addonTotal;
                }

                const baseUnit = Number(product.basePrice);
                const variantModifier = variantId
                    ? Number(product.variants.find((v) => v.id === variantId)!.priceModifier)
                    : 0;

                // Merge-mode: field-omitted keeps existing addons; explicit []
                // clears; explicit array replaces. Mirror the write-side logic
                // so the preview total matches the persisted line.
                const existingAddonIds: string[] = Array.isArray((existingItem as any)?.addons)
                    ? ((existingItem as any).addons as Array<{ id: string }>).map((a) => a.id)
                    : [];
                const effectiveAddonIds = addonsProvided ? normalizedAddonIds : existingAddonIds;

                const newQty = existingItem ? existingItem.quantity + quantity : quantity;
                const [newAddonMap, newAddonSpecMap] = await Promise.all([
                    fetchAddonRuleMap(effectiveAddonIds),
                    fetchAddonSpecMap(effectiveAddonIds),
                ]);
                const newFileCount = (() => {
                    const incoming = Array.isArray(customDesignUrl)
                        ? customDesignUrl.length
                        : (typeof customDesignUrl === "string" && customDesignUrl.length > 0 ? 1 : 0);
                    if (incoming > 0) return incoming;
                    return existingItem && Array.isArray(existingItem.customDesignUrl)
                        ? (existingItem.customDesignUrl as unknown[]).length
                        : 0;
                })();
                const newMetadata = metadata !== undefined ? metadata : (existingItem as any)?.metadata ?? null;

                const newAddonTotal = computeLineAddonsTotal(
                    {
                        quantity: newQty,
                        addons: effectiveAddonIds,
                        metadata: newMetadata,
                        fileCount: newFileCount,
                    },
                    newAddonMap,
                    newAddonSpecMap,
                );

                prospective += (baseUnit + variantModifier) * newQty + newAddonTotal;

                if (prospective < minValue) {
                    const shortage = minValue - prospective;
                    throw new AppError(
                        `Add ₹${shortage.toFixed(2)} more to "${category.name}" to meet its minimum cart value of ₹${minValue.toFixed(2)}.`,
                        400,
                        {
                            shortfalls: [
                                {
                                    categoryId: category.id,
                                    categoryName: category.name,
                                    required: minValue,
                                    current: prospective,
                                },
                            ],
                        },
                    );
                }
            }
        }

        let cartItem;
        if (existingItem) {
            // Merge uploaded files — new urls take precedence when supplied,
            // otherwise keep what the user already uploaded.
            const existingUrls = normalizeDesignUrls(existingItem.customDesignUrl);
            const newUrls = normalizeDesignUrls(customDesignUrl);
            const finalUrls = newUrls.length > 0 ? newUrls : existingUrls;

            // Addon reconciliation policy:
            //  - Field omitted       -> keep current addons exactly.
            //  - Field === []        -> clear all addons (user dropped them).
            //  - Field === [...ids]  -> replace with the supplied ids.
            const existingAddonIds: string[] = Array.isArray((existingItem as any).addons)
                ? ((existingItem as any).addons as Array<{ id: string }>).map((a) => a.id)
                : [];
            const finalAddonIds = addonsProvided ? normalizedAddonIds : existingAddonIds;

            cartItem = await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: existingItem.quantity + quantity,
                    customDesignUrl: finalUrls,
                    customText: customText || existingItem.customText,
                    hasAddon: finalAddonIds.length > 0 || Boolean(hasAddon),
                    ...(addonsProvided && {
                        // `set` handles both "replace" and "clear" semantics.
                        addons: { set: finalAddonIds.map((id) => ({ id })) },
                    }),
                    metadata: metadata !== undefined ? metadata : (existingItem as any).metadata,
                },
                include: {
                    product: {
                        include: { category: true, images: true },
                    },
                    variant: true,
                    addons: { select: CART_ADDON_SELECT },
                },
            });
        } else {
            // Fresh cart item — connect any supplied addons directly.
            const normalizedUrls = normalizeDesignUrls(customDesignUrl);

            cartItem = await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    variantId: variantId || null,
                    quantity,
                    customDesignUrl: normalizedUrls,
                    customText: customText || null,
                    hasAddon: normalizedAddonIds.length > 0 || Boolean(hasAddon),
                    ...(normalizedAddonIds.length > 0 && {
                        addons: {
                            connect: normalizedAddonIds.map((id) => ({ id })),
                        },
                    }),
                    metadata: metadata !== undefined ? metadata : null,
                },
                include: {
                    product: {
                        include: { category: true, images: true },
                    },
                    variant: true,
                    addons: { select: CART_ADDON_SELECT },
                },
            });
        }

        return sendSuccess(res, cartItem, "Item added to cart successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Update cart item quantity
export const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const itemId = getParamAsString(req.params.itemId, "Item ID");
        const { quantity, customDesignUrl, customText, addons } = req.body;
        // Phase 0 — sanitize incoming metadata.files before persistence so a
        // direct edit (e.g. addon toggle on the cart page) cannot inject a
        // malformed `files` array. No-op when the client omits the field.
        const metadata = req.body.metadata !== undefined
            ? applyPricingFilesToMetadata(req.body.metadata)
            : undefined;

        if (!quantity || quantity < 1) {
            throw new ValidationError("Quantity must be at least 1");
        }

        // Verify cart item belongs to user
        const cartItem = await prisma.cartItem.findUnique({
            where: { id: itemId },
            include: {
                cart: true,
                product: true,
                variant: true,
            },
        });

        if (!cartItem) {
            throw new NotFoundError("Cart item not found");
        }

        if (cartItem.cart.userId !== req.user.id) {
            throw new UnauthorizedError("Not authorized to update this cart item");
        }

        // Check stock — variant stock is always enforced when present
        // (variants only exist on physical SKUs). Product-level stock is
        // skipped for service-style products since their `quantity` is
        // `pageCount × copies`, not a count of orderable units (issue #82).
        if (cartItem.variant) {
            if (cartItem.variant.stock < quantity) {
                throw new ValidationError("Insufficient stock");
            }
        } else if (isStockTrackedProduct(cartItem.product) && cartItem.product.stock < quantity) {
            throw new ValidationError("Insufficient stock");
        }

        // Merge/replace file urls (new wins, otherwise preserve existing).
        const existingUrls = normalizeDesignUrls(cartItem.customDesignUrl);
        const newUrls = customDesignUrl !== undefined
            ? normalizeDesignUrls(customDesignUrl)
            : existingUrls;

        // Mirror addToCart semantics: only touch the m2m relation when the
        // client explicitly includes `addons` in the payload. This lets the
        // cart page edit addons (e.g. toggle binding) without regressing the
        // common "just bump quantity" update path.
        const addonsProvided = Array.isArray(addons);
        const normalizedAddonIds = addonsProvided ? normalizeAddonIds(addons) : [];

        const updatedItem = await prisma.cartItem.update({
            where: { id: itemId },
            data: {
                quantity,
                customDesignUrl: newUrls,
                customText: customText !== undefined ? customText : cartItem.customText,
                ...(metadata !== undefined && { metadata }),
                ...(addonsProvided && {
                    hasAddon: normalizedAddonIds.length > 0,
                    addons: { set: normalizedAddonIds.map((id) => ({ id })) },
                }),
            },
            include: {
                product: {
                    include: { category: true, images: true },
                },
                variant: true,
                addons: { select: CART_ADDON_SELECT },
            },
        });

        return sendSuccess(res, updatedItem, "Cart item updated successfully");
    } catch (error) {
        next(error);
    }
};

// Remove item from cart
export const removeFromCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const itemId = getParamAsString(req.params.itemId, "Item ID");

        // Verify cart item belongs to user
        const cartItem = await prisma.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true },
        });

        if (!cartItem) {
            throw new NotFoundError("Cart item not found");
        }

        if (cartItem.cart.userId !== req.user.id) {
            throw new UnauthorizedError("Not authorized to remove this cart item");
        }

        // Delete FTP files associated with this cart item
        // Normalize customDesignUrl to array
        const designUrls = normalizeDesignUrls(cartItem.customDesignUrl);

        if (designUrls.length > 0) {
            // Extract FTP paths from URLs/paths
            const ftpPaths = Array.from(
                new Set(
                    designUrls
                        .map((urlOrKey) => extractFtpPathFromUrl(urlOrKey))
                        .filter((p) => p.trim() !== "")
                )
            );

            // Issue #86 — refuse to delete files that are still referenced
            // by another CartItem or any OrderItem. Self-reference (the
            // item we're about to remove) is excluded via
            // `excludeCartItemId` so the file is only spared when
            // something OTHER than this row points at it.
            const { deletable, refused } = await partitionDeletableFtpPaths(
                ftpPaths,
                { excludeCartItemId: itemId },
            );
            for (const refusedPath of refused) {
                console.warn(`[FTP] refused to delete referenced file: ${refusedPath}`);
            }

            // Delete only the unreferenced ones (allSettled keeps the loop
            // resilient to per-file FTP burps).
            if (deletable.length > 0) {
                const deleteResults = await Promise.allSettled(
                    deletable.map((p) => deleteFromFTP(p))
                );

                // Log any failures (but don't throw - cart item deletion should succeed)
                deleteResults.forEach((result, index) => {
                    if (result.status === "rejected") {
                        console.error(`[Cart] Failed to delete FTP file ${deletable[index]}:`, result.reason);
                    }
                });
            }
        }

        await prisma.cartItem.delete({
            where: { id: itemId },
        });

        return sendSuccess(res, null, "Item removed from cart successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Preflight validation: check the authenticated user's cart against each
 * category's `minCartValue`. When a subset of cart item ids is posted (e.g.
 * the user is checking out only a selection) only those items contribute to
 * the per-category subtotal.
 *
 * Response shape:
 *   { ok: true, shortfalls: [] }                                    when all OK
 *   { ok: false, shortfalls: [{ categoryId, categoryName, required, current }] }
 *
 * Always returns 200 — the client decides how to surface the result. The
 * order-creation endpoint is the source of truth and will still reject the
 * order with a 400 if the rule is violated.
 */
export const validateCartMinimums = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const itemIds: string[] | undefined = Array.isArray(req.body?.itemIds)
            ? (req.body.itemIds as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0)
            : undefined;

        const cart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
            select: {
                items: {
                    select: {
                        id: true,
                        productId: true,
                        quantity: true,
                        customDesignUrl: true,
                        metadata: true,
                        product: {
                            select: {
                                id: true,
                                basePrice: true,
                                sellingPrice: true,
                            },
                        },
                        variant: {
                            select: { priceModifier: true },
                        },
                        addons: {
                            select: CART_ADDON_SELECT,
                        },
                    },
                },
            },
        });

        const items = (cart?.items ?? []).filter((item) =>
            !itemIds || itemIds.length === 0 ? true : itemIds.includes(item.id)
        );

        if (items.length === 0) {
            return sendSuccess(res, { ok: true, shortfalls: [] });
        }

        const lines = await Promise.all(items.map(async (item) => {
            const productBasePrice = Number(item.product.sellingPrice ?? item.product.basePrice);
            const variantPrice = item.variant ? Number(item.variant.priceModifier) : 0;
            const unitBasePrice = productBasePrice + variantPrice;

            const pageCount = (item.metadata as any)?.pageCount || null;
            const copies = (item.metadata as any)?.copies || 1;

            const { effectivePageCount, hasHalfPage } = await calculateProductEffectivePages(
                item.productId,
                pageCount,
                item.quantity,
                copies,
            );

            const effectivePages = pageCount && pageCount > 0
                ? (hasHalfPage ? effectivePageCount : pageCount) * copies
                : item.quantity;

            const lineFileCount = normalizeDesignUrls(item.customDesignUrl).length;
            const baseRule = await prisma.categoryPricingRule.findFirst({
                where: {
                    productId: item.productId,
                    ruleType: { in: ["BASE_PRICE", "SPECIFICATION_COMBINATION"] },
                    isActive: true,
                },
                select: { fileMultiplier: true },
            });
            const baseUsesFileMultiplier = Boolean((baseRule as { fileMultiplier?: boolean } | null)?.fileMultiplier);
            const safeFileCount = Math.max(1, lineFileCount);

            const baseTotal = baseUsesFileMultiplier
                ? unitBasePrice * safeFileCount
                : pageCount && pageCount > 0
                    ? unitBasePrice * effectivePages
                    : unitBasePrice * item.quantity;

            let addonTotal = 0;
            if (item.addons && item.addons.length > 0) {
                // Addon math gates on raw pageCount × copies — half-page
                // reduction stays a base-price concern.
                const pricingLine = {
                    quantity: item.quantity,
                    addons: (item.addons as AddonPricingRule[]).map((a) => a.id),
                    metadata: {
                        pageCount: pageCount && pageCount > 0 ? pageCount : null,
                        copies,
                    },
                    fileCount: lineFileCount,
                };
                for (const addon of item.addons as AddonPricingRule[]) {
                    addonTotal += computeAddonLineTotal(addon, pricingLine);
                }
            }

            return {
                productId: item.productId,
                lineTotal: baseTotal + addonTotal,
            };
        }));

        const shortfalls = await computeCategoryCartShortfalls(lines);
        return sendSuccess(res, { ok: shortfalls.length === 0, shortfalls });
    } catch (error) {
        next(error);
    }
};

/**
 * Verify a list of FTP file paths still exist with size > 0.
 *
 * Powers the cart-page / checkout-page "retroactive 0KB sweep" added for
 * issue #56: the prior pre-upload defences only catch *new* empties, so
 * pre-existing cart items can still reference files that were uploaded
 * before the fix landed.
 *
 * Request:   { paths: string[] }  — relative FTP paths and/or full URLs.
 * Response:  { valid: string[], invalid: Array<{ path, reason }> }
 *             reason ∈ "missing" | "empty" | "unreadable"
 *
 * Always 200 — the client decides what to do (strip the path from the
 * cart row, surface a toast, block checkout). The server-side payment
 * guard re-runs the same check before opening Razorpay so we never
 * collect money for a corrupt-file order.
 */
export const verifyCartFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const rawPaths: unknown = (req.body as { paths?: unknown } | undefined)?.paths;
        if (!Array.isArray(rawPaths)) {
            throw new ValidationError("`paths` must be an array of strings");
        }

        // Normalise to canonical relative paths up-front so the response
        // mirrors what the cart stores. Mixed full-URL / relative inputs
        // are accepted — extractFtpPathFromUrl handles both.
        const paths = rawPaths
            .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
            .map((p) => extractFtpPathFromUrl(p.trim()));

        if (paths.length === 0) {
            return sendSuccess(res, { valid: [], invalid: [] });
        }

        const result = await verifyFTPFiles(paths);
        return sendSuccess(res, result);
    } catch (error) {
        next(error);
    }
};

// Clear cart
export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const cart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
            include: {
                items: true,
            },
        });

        if (cart && cart.items.length > 0) {
            // Delete FTP files for all cart items before deleting the items
            const ftpPaths: string[] = [];

            for (const item of cart.items) {
                const designUrls = normalizeDesignUrls(item.customDesignUrl);

                for (const urlOrKey of designUrls) {
                    const ftpPath = extractFtpPathFromUrl(urlOrKey);
                    if (ftpPath.trim()) ftpPaths.push(ftpPath);
                }
            }

            // Issue #86 — exclude the entire cart's own items from the
            // reference check (we're about to delete them all). Any path
            // still referenced by another user's cart OR by ANY OrderItem
            // is kept on FTP to avoid stranding dead URLs on orders.
            const dedupedPaths = Array.from(new Set(ftpPaths));
            const { deletable, refused } = await partitionDeletableFtpPaths(
                dedupedPaths,
                { excludeCartId: cart.id },
            );
            for (const refusedPath of refused) {
                console.warn(`[FTP] refused to delete referenced file: ${refusedPath}`);
            }

            // Delete only the unreferenced ones
            if (deletable.length > 0) {
                const deleteResults = await Promise.allSettled(
                    deletable.map((p) => deleteFromFTP(p))
                );

                // Log any failures (but don't throw - cart clearing should succeed)
                deleteResults.forEach((result, index) => {
                    if (result.status === "rejected") {
                        console.error(`[Cart] Failed to delete FTP file ${deletable[index]}:`, result.reason);
                    }
                });
            }

            // Delete all cart items
            await prisma.cartItem.deleteMany({
                where: { cartId: cart.id },
            });
        }

        return sendSuccess(res, null, "Cart cleared successfully");
    } catch (error) {
        next(error);
    }
};

// ─── Calculate-pricing endpoint (Phase 1 of per-file addon pricing) ──────────
// Spec: prompts/per-file-addon-pricing-architecture.md §2 Phase 1.
//
// Public, no auth — matches the public upload/verify surface used during the
// guest service-configuration flow. Web/admin call this whenever they need a
// price; no addon math is allowed to live in the client.
//
// The math is delegated to `utils/addon-pricing.ts` so this controller stays a
// thin orchestration layer (load category + rules → resolve base → run engine
// → return totals). Adding Phase 2's per-file branch later means touching only
// the engine, not this controller.

export interface CalculatePricingFileInput {
    url: string;
    pageCount: number;
}

export interface CalculatePricingRequestBody {
    categoryId?: string;
    selectedSpecifications?: Record<string, string>;
    selectedAddons?: string[];
    files?: CalculatePricingFileInput[];
    copies?: number;
    side?: "one" | "both";
}

export interface CalculatePricingAddonResponse {
    ruleId: string;
    name: string;
    total: number;
    /** Phase 2 — per-file breakdown for UI rendering. Always populated
     *  (one entry per file for `perFileEvaluation` rules; one synthetic
     *  aggregate entry with `fileUrl: null` otherwise) so the client
     *  can render uniformly without branching on the rule shape. */
    breakdown: AddonBreakdownEntry[];
    /** Rule's page-range tier so UI can disambiguate two addons that
     *  share the same spec-derived `name` but cover different ranges
     *  (e.g. two `wiro binding` tiers for different page counts). */
    range?: { min: number | null; max: number | null };
}

export interface CalculatePricingResponse {
    baseSubtotal: number;
    addonsSubtotal: number;
    total: number;
    addons: CalculatePricingAddonResponse[];
    /** Total raw pages from `files[].pageCount`. Mirrored on the response so
     *  the client can show "12 pages × 2 copies" detail without re-summing. */
    pageCount: number;
    /** Post-half-page reduction (per copy). Returned for UI display only —
     *  pricing is already applied on the server. */
    effectivePageCount?: number;
    hasHalfPageAdjustment: boolean;
}

/**
 * Build a human label for an addon rule. Mirrors the client-side
 * `getAddonLabel`: prefer the rule's `specificationValues` ("paper: A4,
 * binding: spiral"); fall back to "Addon".
 */
const buildAddonName = (
    specs: Record<string, unknown> | null | undefined,
): string => {
    if (!specs || typeof specs !== "object") return "Addon";
    const entries = Object.entries(specs);
    if (entries.length === 0) return "Addon";
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ");
};

const sanitizeCalculatePricingFiles = (
    raw: unknown,
): CalculatePricingFileInput[] => {
    if (!Array.isArray(raw)) return [];
    const out: CalculatePricingFileInput[] = [];
    const MAX_FILES = 100;
    for (const entry of raw.slice(0, MAX_FILES)) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as { url?: unknown; pageCount?: unknown };
        const url = typeof e.url === "string" ? e.url.trim() : "";
        if (!url) continue;
        const pageCount = Number(e.pageCount);
        if (!Number.isFinite(pageCount) || pageCount <= 0) {
            throw new ValidationError(
                "files[i].pageCount must be a positive number",
            );
        }
        out.push({ url, pageCount: Math.floor(pageCount) });
    }
    return out;
};

/**
 * POST /api/v1/cart/calculate-pricing
 *
 * Single source of truth for the live price card on `/services/<slug>`, the
 * cart preview, and the checkout summary. Public so guest sessions get the
 * same number as authenticated ones.
 */
export const calculatePricing = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    // Per-request id so the two log lines emitted below (input + result)
    // can be correlated when several pricing calls are interleaved across
    // tabs / surfaces. `x-pagz-source` lets the client tag the call site
    // (`services-page`, `guest-cart`, ...) — surfaces drift between the
    // two surfaces in prod logs without needing to repro locally. Issue #93.
    const requestId =
        (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"]) ||
        randomUUID();
    const source =
        (typeof req.headers["x-pagz-source"] === "string" && req.headers["x-pagz-source"]) ||
        "unknown";

    try {
        const body = (req.body ?? {}) as CalculatePricingRequestBody;

        const categoryId = typeof body.categoryId === "string"
            ? body.categoryId.trim()
            : "";
        if (!categoryId) {
            throw new ValidationError("categoryId is required");
        }

        const selectedSpecifications: Record<string, string> = {};
        if (body.selectedSpecifications && typeof body.selectedSpecifications === "object") {
            for (const [k, v] of Object.entries(body.selectedSpecifications)) {
                if (typeof k !== "string" || k.length === 0) continue;
                selectedSpecifications[k] = v === null || v === undefined ? "" : String(v);
            }
        }

        const copiesRaw = Number(body.copies);
        const copies = Number.isFinite(copiesRaw) && copiesRaw >= 1
            ? Math.floor(copiesRaw)
            : 1;
        if (body.copies !== undefined && (!Number.isFinite(copiesRaw) || copiesRaw < 1)) {
            throw new ValidationError("copies must be >= 1");
        }

        const files = sanitizeCalculatePricingFiles(body.files);
        const pageCount = files.reduce((sum, f) => sum + f.pageCount, 0);
        const fileCount = files.length;

        const requestedAddonIds = normalizeAddonIds(body.selectedAddons);

        console.log(
            `[calculate-pricing] req=${requestId} source=${source} input`,
            {
                categoryId,
                selectedSpecifications,
                selectedAddons: requestedAddonIds,
                copies,
                files: files.map((f) => ({ url: f.url, pageCount: f.pageCount })),
                pageCount,
                fileCount,
                side: body.side ?? null,
            },
        );

        // Load the category + active rules in a single query. Rules drive both
        // base and addon math — keeping it to one DB roundtrip per request.
        const category = await prisma.category.findUnique({
            where: { id: categoryId, isActive: true },
            include: {
                pricingRules: {
                    where: { isActive: true },
                    orderBy: { priority: "desc" },
                },
                specifications: {
                    include: {
                        options: { where: { isActive: true } },
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Half-page reduction — derive effective per-copy pages from the spec
        // map. Reused engine helper so the math is identical to
        // calculate-price + cart/order controllers.
        const halfPage = processHalfPageCalculation(
            selectedSpecifications,
            category.specifications.map((s) => ({
                slug: s.slug,
                options: s.options.map((o) => ({
                    value: o.value,
                    label: o.label,
                    metadata: o.metadata,
                })),
            })),
            pageCount > 0 ? pageCount : null,
            pageCount > 0 ? pageCount * copies : 1,
            copies,
        );

        // `side` is supplied for forward-compat (Phase 2 may bypass the spec
        // lookup); when present + "both" we ALSO trigger the half-page path
        // even when no spec option is flagged. Conservative: only flips the
        // flag, doesn't override per-page math when the spec already won.
        const explicitHalfPage = body.side === "both";
        const hasHalfPage = halfPage.hasHalfPageOption || (explicitHalfPage && pageCount > 0);
        const effectivePageCount = hasHalfPage && pageCount > 0
            ? Math.ceil(pageCount / 2)
            : pageCount;

        // ── Base subtotal ────────────────────────────────────────────────────
        // Spec-match BASE_PRICE / SPECIFICATION_COMBINATION rules to compute
        // baseSubtotal. Mirrors the existing logic in
        // `categoryController.calculateCategoryPricePublic` but stays focused
        // on the contract this endpoint exposes (no breakdown rows, no
        // tier-rule emissions).
        let baseSubtotal = 0;
        const matchingBaseRules = category.pricingRules.filter((rule) => {
            if (rule.ruleType !== "BASE_PRICE" && rule.ruleType !== "SPECIFICATION_COMBINATION") {
                return false;
            }
            const specs = (rule.specificationValues || {}) as Record<string, unknown>;
            for (const [k, v] of Object.entries(specs)) {
                if (String(selectedSpecifications[k] ?? "") !== String(v ?? "")) return false;
            }
            return true;
        });

        const baseRule = matchingBaseRules[0];
        if (baseRule) {
            const basePrice = baseRule.basePrice ? Number(baseRule.basePrice) : 0;
            const baseUsesFileMultiplier = Boolean(
                (baseRule as { fileMultiplier?: boolean }).fileMultiplier,
            );
            const safeFileCount = Math.max(1, fileCount);
            const totalEffectivePages = effectivePageCount * copies;

            if (baseUsesFileMultiplier) {
                baseSubtotal = basePrice * safeFileCount;
            } else if (baseRule.quantityMultiplier && totalEffectivePages > 0) {
                baseSubtotal = basePrice * totalEffectivePages;
            } else {
                baseSubtotal = basePrice;
            }
        }

        console.log(
            `[calculate-pricing] req=${requestId} base`,
            {
                matchingBaseRules: matchingBaseRules.map((r) => ({
                    id: r.id,
                    basePrice: r.basePrice ? Number(r.basePrice) : 0,
                    ruleType: r.ruleType,
                    specs: r.specificationValues,
                })),
                chosenBaseRuleId: baseRule?.id ?? null,
                baseSubtotal: Number(baseSubtotal.toFixed(2)),
            },
        );

        // ── Addons ───────────────────────────────────────────────────────────
        // Filter the client-supplied addon ids down to live addon rules on
        // this category. Unknown ids (admin deleted mid-session) are ignored
        // rather than 4xx'd so a stale guest payload doesn't break checkout.
        const addonRulesById = new Map(
            category.pricingRules
                .filter((r) => r.ruleType === "ADDON")
                .map((r) => [r.id, r]),
        );

        // Defense (Step 4 of #93): surface ids the client sent that no longer
        // exist as live ADDON rules on this category — admin deleted them or
        // the guest stored a stale payload from a previous session.
        const staleAddonIds = requestedAddonIds.filter((id) => !addonRulesById.has(id));
        if (staleAddonIds.length > 0) {
            console.warn(
                `[calculate-pricing] req=${requestId} stale addon ids dropped`,
                { categoryId, source, staleAddonIds },
            );
        }

        const activeAddonInputs: Array<{
            rule: AddonPricingRule;
            specs: Record<string, unknown> | null;
            name: string;
        }> = [];

        for (const id of requestedAddonIds) {
            const rule = addonRulesById.get(id);
            if (!rule) continue;
            activeAddonInputs.push({
                rule: {
                    id: rule.id,
                    basePrice: rule.basePrice,
                    priceModifier: rule.priceModifier,
                    quantityMultiplier: rule.quantityMultiplier,
                    fileMultiplier: Boolean((rule as { fileMultiplier?: boolean }).fileMultiplier),
                    copyMultiplier: Boolean((rule as { copyMultiplier?: boolean }).copyMultiplier),
                    perFileEvaluation: Boolean(
                        (rule as { perFileEvaluation?: boolean }).perFileEvaluation,
                    ),
                    minQuantity: rule.minQuantity,
                    maxQuantity: rule.maxQuantity,
                    isActive: rule.isActive,
                },
                specs: (rule.specificationValues as Record<string, unknown> | null) ?? null,
                name: buildAddonName(rule.specificationValues as Record<string, unknown> | null),
            });
        }

        // Spec-group dominance pre-pass — drops same-spec tier rules that
        // would otherwise double-charge alongside a copyMultiplier sibling.
        // Same engine helper the cart + order controllers run.
        const surviving = resolveActiveAddons(
            activeAddonInputs.map(({ rule, specs }) => ({ rule, specs })),
        );
        const survivingIds = new Set(surviving.map((r) => r.id));

        // `side` is propagated into metadata so the per-file
        // (perFileEvaluation) branch can re-derive each file's effective
        // page count via `halfPageReduce` without re-reading specs.
        // Prefer the explicit body.side, fall back to inferring "both"
        // from the half-page spec detection above.
        const sideForMeta: "one" | "both" | undefined = body.side
            ? body.side
            : hasHalfPage ? "both" : undefined;
        const lineMetadata = {
            pageCount: pageCount > 0 ? pageCount : null,
            copies,
            effectivePageCount: hasHalfPage && effectivePageCount > 0
                ? effectivePageCount
                : null,
            files: files.length > 0 ? files : undefined,
            side: sideForMeta,
        };

        // Single summary warn per pricing request — surfaces the
        // perFileEvaluation aggregate fallback once even though the
        // engine itself runs once per addon. Issue #77.
        warnPerFileFallback(
            [{
                quantity: pageCount > 0 ? pageCount * copies : 1,
                addons: activeAddonInputs.map((e) => e.rule.id),
                metadata: lineMetadata,
                fileCount,
            }],
            new Map(activeAddonInputs.map((e) => [e.rule.id, e.rule])),
            { categoryId, source: "calculatePricing" },
        );

        const addonsResponse: CalculatePricingAddonResponse[] = [];
        let addonsSubtotal = 0;
        for (const entry of activeAddonInputs) {
            if (!survivingIds.has(entry.rule.id)) continue;
            const lineInput = {
                quantity: pageCount > 0 ? pageCount * copies : 1,
                addons: [entry.rule.id],
                metadata: lineMetadata,
                fileCount,
            };
            const total = computeAddonLineTotal(entry.rule, lineInput);
            if (total <= 0) continue;
            addonsSubtotal += total;
            addonsResponse.push({
                ruleId: entry.rule.id,
                name: entry.name,
                total: Number(total.toFixed(2)),
                breakdown: computeAddonBreakdown(entry.rule, lineInput),
                range: {
                    min: entry.rule.minQuantity ?? null,
                    max: entry.rule.maxQuantity ?? null,
                },
            });
        }

        const responseBody: CalculatePricingResponse = {
            baseSubtotal: Number(baseSubtotal.toFixed(2)),
            addonsSubtotal: Number(addonsSubtotal.toFixed(2)),
            total: Number((baseSubtotal + addonsSubtotal).toFixed(2)),
            addons: addonsResponse,
            pageCount,
            effectivePageCount: hasHalfPage && effectivePageCount > 0
                ? effectivePageCount
                : undefined,
            hasHalfPageAdjustment: hasHalfPage,
        };

        console.log(
            `[calculate-pricing] req=${requestId} result`,
            {
                addonRulesMatched: activeAddonInputs.length,
                addonsRequested: requestedAddonIds.length,
                survivingIds: Array.from(survivingIds),
                activeAddonInputs: activeAddonInputs.map((e) => ({
                    ruleId: e.rule.id,
                    name: e.name,
                    perFileEvaluation: e.rule.perFileEvaluation,
                    copyMultiplier: e.rule.copyMultiplier,
                    fileMultiplier: e.rule.fileMultiplier,
                    minQuantity: e.rule.minQuantity,
                    maxQuantity: e.rule.maxQuantity,
                })),
                addonsResponse: addonsResponse.map((a) => ({
                    ruleId: a.ruleId,
                    total: a.total,
                    breakdownLen: a.breakdown.length,
                })),
                baseSubtotal: responseBody.baseSubtotal,
                addonsSubtotal: responseBody.addonsSubtotal,
                total: responseBody.total,
            },
        );

        return sendSuccess(res, responseBody);
    } catch (error) {
        next(error);
    }
};

