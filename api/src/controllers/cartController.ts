import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { calculateProductEffectivePages, getProductHalfPageBreakdown } from "../utils/product-half-page.js";
import { deleteFromFTP, extractFtpPathFromUrl } from "../services/ftp.js";
import { getParamAsString } from "../utils/db-utils.js";
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
                        // @ts-ignore - updated in Prisma schema to be a relation
                        addons: {
                            select: {
                                id: true,
                                categoryId: true,
                                ruleType: true,
                                basePrice: true,
                                priceModifier: true,
                                quantityMultiplier: true,
                                minQuantity: true,
                                maxQuantity: true,
                            },
                        },
                    },
                },
            },
        });

        // Create cart if it doesn't exist
        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId: req.user.id },
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    category: {
                                        include: {
                                            images: {
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
                            variant: true,
                            // @ts-ignore - updated in Prisma schema to be a relation
                            addons: true,
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

            let addonUnitPrice = 0;
            let addonTotal = 0;
 
            if (item.addons && item.addons.length > 0) {
                for (const addon of item.addons as any[]) {
                    const rawAddonPrice =
                        addon.priceModifier !== null && addon.priceModifier !== undefined
                            ? Number(addon.priceModifier)
                            : addon.basePrice !== null && addon.basePrice !== undefined
                                ? Number(addon.basePrice)
                                : 0;

                    addonUnitPrice += rawAddonPrice;

                    // Calculate addon price based on page ranges and quantity multiplier
                    // Use effective pages (considering half-page) for addon calculations
                    let addonPrice = 0;
                    if (pageCount && pageCount > 0) {
                        // Check if effectivePages is in addon's page range
                        const hasPageRange = addon.minQuantity != null || addon.maxQuantity != null;
                        if (hasPageRange) {
                            const inRange =
                                (addon.minQuantity == null || effectivePages >= addon.minQuantity) &&
                                (addon.maxQuantity == null || effectivePages <= addon.maxQuantity);
                            if (!inRange) {
                                continue; // Skip this addon if not in range
                            }
                        }
                        
                        // Calculate addon price using effective pages (already accounts for half-page)
                        if (addon.quantityMultiplier) {
                            addonPrice = rawAddonPrice * effectivePages;
                        } else {
                            addonPrice = rawAddonPrice;
                        }
                    } else {
                        // No page count, use quantity multiplier if enabled
                        const multiplier = addon.quantityMultiplier ? item.quantity : 1;
                        addonPrice = rawAddonPrice * multiplier;
                    }
                    
                    addonTotal += addonPrice;
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
                // @ts-ignore - updated in Prisma schema to be a relation
                addons: true,
            },
        });

        let cartItem;
        if (existingItem) {
            // Normalize existing customDesignUrl to array (handle legacy string values and Prisma types)
            let existingUrls: string[] = [];
            if (existingItem.customDesignUrl) {
                if (Array.isArray(existingItem.customDesignUrl)) {
                    existingUrls = (existingItem.customDesignUrl as unknown[]).filter((url) => {
                        return typeof url === 'string' && url.trim().length > 0;
                    }) as string[];
                } else if (typeof existingItem.customDesignUrl === 'string') {
                    const urlStr = String(existingItem.customDesignUrl).trim();
                    if (urlStr.length > 0) {
                        existingUrls = [urlStr];
                    }
                }
            }

            // Normalize new customDesignUrl to array
            let newUrls: string[] = [];
            if (customDesignUrl) {
                if (Array.isArray(customDesignUrl)) {
                    newUrls = customDesignUrl.filter((url) => {
                        return typeof url === 'string' && url.trim().length > 0;
                    }) as string[];
                } else if (typeof customDesignUrl === 'string' && customDesignUrl.length > 0) {
                    newUrls = [customDesignUrl];
                }
            }

            // Merge or replace URLs (if new URLs provided, use them; otherwise keep existing)
            const finalUrls = newUrls.length > 0 ? newUrls : existingUrls;

            // Normalize addons
            const newAddonIds: string[] = Array.isArray(addons)
                ? (addons as any[]).filter((id) => typeof id === "string" && id.trim().length > 0) as string[]
                : [];
            const existingAddonIds: string[] = Array.isArray((existingItem as any).addons)
                ? ((existingItem as any).addons as any[])
                    .map((addon) => addon.id)
                    .filter((id: unknown) => typeof id === "string" && (id as string).trim().length > 0) as string[]
                : [];
            const mergedAddons = Array.from(new Set([...existingAddonIds, ...newAddonIds]));

            // Update quantity
            cartItem = await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: existingItem.quantity + quantity,
                    customDesignUrl: finalUrls,
                    customText: customText || existingItem.customText,
                    hasAddon: mergedAddons.length > 0 || Boolean(hasAddon),
                    // @ts-ignore - using relation field as defined in updated Prisma schema
                    addons:
                        mergedAddons.length > 0
                            ? {
                                set: mergedAddons.map((id) => ({ id })),
                            }
                            : {
                                set: [],
                            },
                    metadata: metadata !== undefined ? metadata : (existingItem as any).metadata,
                },
                include: {
                    product: {
                        include: {
                            category: true,
                            images: true,
                        },
                    },
                    variant: true,
                },
            });
        } else {
            // Create new cart item
            // Normalize customDesignUrl to always be an array
            let normalizedUrls: string[] = [];
            if (customDesignUrl) {
                if (Array.isArray(customDesignUrl)) {
                    normalizedUrls = customDesignUrl.filter((url): url is string => typeof url === 'string' && url.length > 0);
                } else if (typeof customDesignUrl === 'string' && customDesignUrl.length > 0) {
                    normalizedUrls = [customDesignUrl];
                }
            }

            // Normalize addons for new item
            const addonIds: string[] = Array.isArray(addons)
                ? (addons as any[]).filter((id) => typeof id === "string" && id.trim().length > 0) as string[]
                : [];

            cartItem = await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    variantId: variantId || null,
                    quantity,
                    customDesignUrl: normalizedUrls,
                    customText: customText || null,
                    hasAddon: addonIds.length > 0 || Boolean(hasAddon),
                    // @ts-ignore - using relation field as defined in updated Prisma schema
                    addons:
                        addonIds.length > 0
                            ? {
                                connect: addonIds.map((id) => ({ id })),
                            }
                            : undefined,
                    metadata: metadata !== undefined ? metadata : null,
                },
                include: {
                    product: {
                        include: {
                            category: true,
                            images: true,
                        },
                    },
                    variant: true,
                    // @ts-ignore - updated in Prisma schema to be a relation
                    addons: true,
                },
            } as any);
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
        const { quantity, customDesignUrl, customText } = req.body;

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

        // Normalize existing customDesignUrl to array (handle legacy string values and Prisma types)
        let existingUrls: string[] = [];
        if (cartItem.customDesignUrl) {
            if (Array.isArray(cartItem.customDesignUrl)) {
                for (const url of cartItem.customDesignUrl) {
                    const urlStr = String(url);
                    if (urlStr && urlStr.trim().length > 0) {
                        existingUrls.push(urlStr.trim());
                    }
                }
            } else {
                const urlStr = String(cartItem.customDesignUrl).trim();
                if (urlStr.length > 0) {
                    existingUrls = [urlStr];
                }
            }
        }

        // Normalize new customDesignUrl to array
        let newUrls: string[] = [];
        if (customDesignUrl !== undefined) {
            if (Array.isArray(customDesignUrl)) {
                newUrls = customDesignUrl.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
            } else if (customDesignUrl && typeof customDesignUrl === 'string' && customDesignUrl.length > 0) {
                newUrls = [customDesignUrl];
            }
        } else {
            newUrls = existingUrls;
        }

        const updatedItem = await prisma.cartItem.update({
            where: { id: itemId },
            data: {
                quantity,
                customDesignUrl: newUrls,
                customText: customText !== undefined ? customText : cartItem.customText,
            },
            include: {
                product: {
                    include: {
                        category: true,
                        images: true,
                    },
                },
                variant: true,
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
        const designUrls = Array.isArray(cartItem.customDesignUrl)
            ? (cartItem.customDesignUrl as any[]).filter((url): url is string => typeof url === "string")
            : typeof cartItem.customDesignUrl === "string"
                ? [cartItem.customDesignUrl]
                : [];

        if (designUrls.length > 0) {
            // Extract FTP paths from URLs/paths
            const ftpPaths = designUrls
                .map((urlOrKey) => extractFtpPathFromUrl(urlOrKey))
                .filter((p) => p.trim() !== "");

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
                const designUrls = Array.isArray(item.customDesignUrl)
                    ? (item.customDesignUrl as any[]).filter((url): url is string => typeof url === "string")
                    : typeof item.customDesignUrl === "string"
                        ? [item.customDesignUrl]
                        : [];

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

