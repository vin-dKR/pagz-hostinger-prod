import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { calculateProductEffectivePages, getProductHalfPageBreakdown } from "../utils/product-half-page.js";
import { deleteFromFTP, extractFtpPathFromUrl } from "../services/ftp.js";
import { getParamAsString } from "../utils/db-utils.js";
import {
    computeAddonLineTotal,
    getAddonUnitPrice,
    normalizeAddonIds,
    type AddonPricingRule,
} from "../utils/addon-pricing.js";

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
    minQuantity: true,
    maxQuantity: true,
} as const;

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
            
            // Calculate effective pages considering half-page option
            const { effectivePageCount, effectiveQuantity, hasHalfPage } = await calculateProductEffectivePages(
                item.productId,
                pageCount,
                item.quantity,
                copies
            );
            
            // Use effective page count for pricing if half-page is applied
            const effectivePages = pageCount && pageCount > 0 
                ? (hasHalfPage ? effectivePageCount : pageCount) * copies
                : item.quantity;
            
            // Calculate base total: if pageCount > 1, multiply by effectivePages, otherwise use quantity
            const baseTotal = pageCount && pageCount > 0
                ? unitBasePrice * effectivePages 
                : unitBasePrice * item.quantity;

            // Addon pricing — honour half-page adjustments by feeding the effective
            // pages into the shared util (so cart UI matches server-side checkout).
            let addonUnitPrice = 0;
            let addonTotal = 0;

            if (item.addons && item.addons.length > 0) {
                const pricingLine = {
                    quantity: item.quantity,
                    addons: (item.addons as AddonPricingRule[]).map((a) => a.id),
                    metadata: {
                        // Use half-page-adjusted page count when applicable so
                        // the addon math mirrors the base price calculation.
                        pageCount: pageCount && pageCount > 0
                            ? (hasHalfPage ? effectivePageCount : pageCount)
                            : null,
                        copies,
                    },
                };

                for (const addon of item.addons as AddonPricingRule[]) {
                    addonUnitPrice += getAddonUnitPrice(addon);
                    addonTotal += computeAddonLineTotal(addon, pricingLine);
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

            // Update metadata with half-page info if applicable
            const updatedMetadata = {
                ...(item.metadata as any || {}),
                ...(hasHalfPage && {
                    effectivePageCount,
                    originalPageCount: pageCount,
                    hasHalfPageAdjustment: true,
                }),
                ...(halfPageBreakdown && {
                    priceBreakdown: [
                        ...((item.metadata as any)?.priceBreakdown || []),
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

        const { productId, variantId, quantity = 1, customDesignUrl, customText, hasAddon, addons, metadata } = req.body;

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

        // Check stock
        if (product.stock < quantity) {
            throw new ValidationError("Insufficient stock");
        }

        // Verify variant if provided
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
        const { quantity, customDesignUrl, customText, addons, metadata } = req.body;

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

        // Check stock
        const stock = cartItem.variant ? cartItem.variant.stock : cartItem.product.stock;
        if (stock < quantity) {
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

            // Delete all FTP files (use allSettled to continue even if some fail)
            if (ftpPaths.length > 0) {
                const deleteResults = await Promise.allSettled(
                    ftpPaths.map((p) => deleteFromFTP(p))
                );

                // Log any failures (but don't throw - cart item deletion should succeed)
                deleteResults.forEach((result, index) => {
                    if (result.status === "rejected") {
                        console.error(`[Cart] Failed to delete FTP file ${ftpPaths[index]}:`, result.reason);
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

            // Delete all FTP files
            if (ftpPaths.length > 0) {
                const deleteResults = await Promise.allSettled(
                    ftpPaths.map((p) => deleteFromFTP(p))
                );

                // Log any failures (but don't throw - cart clearing should succeed)
                deleteResults.forEach((result, index) => {
                    if (result.status === "rejected") {
                        console.error(`[Cart] Failed to delete FTP file ${ftpPaths[index]}:`, result.reason);
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

