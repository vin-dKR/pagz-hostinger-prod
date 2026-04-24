import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { AppError, CartMinimumError, ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { getPublicFtpUrl, extractFtpPathFromUrl } from "../services/ftp.js";
import { calculateProductEffectivePages, getProductHalfPageBreakdown } from "../utils/product-half-page.js";
import { generateInvoicePDF } from "../services/pdfGenerator.js";
import {
    collectAddonIds,
    computeAddonLineTotal,
    computeAddonsSubtotal,
    computeLineAddonsTotal,
    fetchAddonRuleMap,
    normalizeAddonIds,
    type AddonPricingRule,
} from "../utils/addon-pricing.js";
import { computeCategoryCartShortfalls, type CategoryLineContribution } from "../utils/category-min-cart-value.js";

const CUSTOMER_CANCELLABLE_STATUSES = new Set(["PENDING_REVIEW", "ACCEPTED", "PROCESSING"]);
const REFUND_TIMELINE_MESSAGE = "Refund will be credited to your bank account within 7 working days.";

type NumericLike = number | string | { toString(): string };

const getOrderRefundDefaults = (order: { paymentMethod: string; paymentStatus: string; total: NumericLike }) => {
    const isPrepaidSuccess = order.paymentMethod === "ONLINE" && order.paymentStatus === "SUCCESS";
    if (!isPrepaidSuccess) {
        return {
            refundStatus: "NOT_REQUIRED" as const,
            refundEligibleAmount: 0,
        };
    }
    return {
        refundStatus: "PENDING" as const,
        refundEligibleAmount: Number(order.total || 0),
    };
};

// Customer: Create order
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { items, addressId, paymentMethod } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new ValidationError("Order items are required");
        }

        if (!addressId) {
            throw new ValidationError("Shipping address is required");
        }

        if (!paymentMethod || !["ONLINE", "OFFLINE"].includes(paymentMethod)) {
            throw new ValidationError("Payment method must be ONLINE or OFFLINE");
        }

        // Verify address belongs to user
        const address = await prisma.address.findFirst({
            where: {
                id: addressId,
                userId: req.user.id,
            },
        });

        if (!address) {
            throw new NotFoundError("Address not found");
        }

        const { couponCode, shippingCharges = 0, shippingMethodId } = req.body;

        // Resolve shipping method (server-authoritative price when method id is provided)
        let resolvedShippingMethodId: string | null = null;
        let serverShippingCharges: number | null = null;
        if (typeof shippingMethodId === "string" && shippingMethodId.trim().length > 0) {
            const method = await prisma.shippingMethod.findUnique({
                where: { id: shippingMethodId },
            });

            if (!method) {
                throw new ValidationError("Invalid shipping method");
            }

            if (!method.isActive) {
                throw new ValidationError("Selected shipping method is no longer available");
            }

            resolvedShippingMethodId = method.id;
            serverShippingCharges = Number(method.price);
        }

        // Calculate subtotal and validate items
        // OPTIMIZATION: Fetch all products in parallel instead of sequentially
        const productIds = items.map(item => item.productId).filter(Boolean);
        const uniqueProductIds = [...new Set(productIds)];

        // Fetch all products in a single query (parallel)
        const products = await prisma.product.findMany({
            where: {
                id: { in: uniqueProductIds },
                isActive: true,
            },
            include: {
                variants: true,
            },
        });

        // Create a map for O(1) lookup
        const productMap = new Map(products.map(p => [p.id, p]));

        let subtotal = 0;
        const orderItems: Array<{
            productId: string;
            variantId: string | null;
            quantity: number;
            price: number;
            customDesignUrl: string[]; // Array of FTP file paths/URLs
            customText: string | null;
            hasAddon: boolean;
            addons: string[];
            metadata?: any;
            fileCount: number;
        }> = [];
        // Per-line base totals (base price * effective units / files) captured
        // inline so we can later enforce per-category minimum cart values
        // using the same numbers that feed into the subtotal.
        const lineBaseTotals: number[] = [];

        // Validate and calculate prices (no database calls in loop)
        for (const item of items) {
            const { productId, variantId, quantity, customDesignUrl, customText, addons, metadata } = item;

            if (!productId || !quantity || quantity < 1) {
                throw new ValidationError("Invalid order item");
            }

            const product = productMap.get(productId);

            if (!product) {
                throw new NotFoundError(`Product ${productId} not found`);
            }

            // Use sellingPrice if available, otherwise basePrice
            let itemPrice = Number(product.sellingPrice || product.basePrice);

            if (variantId) {
                const variant = product.variants.find((v: { id: string }) => v.id === variantId);
                if (!variant || !variant.available) {
                    throw new ValidationError(`Variant ${variantId} not available`);
                }
                itemPrice += Number(variant.priceModifier);
            }

            // Check for half-page option and adjust pricing
            const pageCount = (metadata as any)?.pageCount || null;
            const copies = (metadata as any)?.copies || 1;

            let effectiveQuantity = quantity;
            let updatedMetadata = metadata || {};

            // If the product's base pricing rule has fileMultiplier, base price
            // scales with the uploaded file count instead of pages/quantity.
            const orderLineFileCount = Array.isArray(customDesignUrl)
                ? customDesignUrl.length
                : customDesignUrl ? 1 : 0;
            const baseRule = await prisma.categoryPricingRule.findFirst({
                where: {
                    productId,
                    ruleType: { in: ["BASE_PRICE", "SPECIFICATION_COMBINATION"] },
                    isActive: true,
                },
                select: { fileMultiplier: true },
            });
            const baseUsesFileMultiplier = Boolean((baseRule as { fileMultiplier?: boolean } | null)?.fileMultiplier);

            let lineBaseTotal = 0;
            if (baseUsesFileMultiplier) {
                const files = Math.max(1, orderLineFileCount);
                lineBaseTotal = itemPrice * files;
                subtotal += lineBaseTotal;
            } else if (pageCount && pageCount > 0) {
                const { effectivePageCount, effectiveQuantity: effQty, hasHalfPage } = await calculateProductEffectivePages(
                    productId,
                    pageCount,
                    quantity,
                    copies
                );

                effectiveQuantity = effQty;

                // If half-page is applied, use effective page count for pricing
                if (hasHalfPage) {
                    // Calculate price based on effective pages instead of original pages
                    const effectivePages = effectivePageCount * copies;
                    lineBaseTotal = itemPrice * effectivePages;
                    subtotal += lineBaseTotal;

                    // Add half-page breakdown to metadata
                    const halfPageBreakdown = await getProductHalfPageBreakdown(
                        productId,
                        pageCount,
                        quantity,
                        copies
                    );

                    updatedMetadata = {
                        ...(metadata as any || {}),
                        effectivePageCount,
                        originalPageCount: pageCount,
                        hasHalfPageAdjustment: true,
                        priceBreakdown: [
                            ...((metadata as any)?.priceBreakdown || []),
                            ...(halfPageBreakdown ? [halfPageBreakdown] : []),
                        ],
                    };
                } else {
                    // Normal pricing: use pageCount * copies
                    const effectivePages = pageCount * copies;
                    lineBaseTotal = itemPrice * effectivePages;
                    subtotal += lineBaseTotal;
                }
            } else {
                // No page count, use quantity
                lineBaseTotal = itemPrice * quantity;
                subtotal += lineBaseTotal;
            }
            lineBaseTotals.push(lineBaseTotal);

            // Normalize addons to array (deduped, trimmed).
            const normalizedAddons = normalizeAddonIds(addons);
            const normalizedDesignUrls: string[] = customDesignUrl
                ? (Array.isArray(customDesignUrl) ? customDesignUrl : [customDesignUrl])
                : [];

            orderItems.push({
                productId,
                variantId: variantId || null,
                quantity: effectiveQuantity,
                price: itemPrice,
                customDesignUrl: normalizedDesignUrls,
                customText: customText || null,
                hasAddon: normalizedAddons.length > 0,
                addons: normalizedAddons,
                metadata: updatedMetadata,
                fileCount: normalizedDesignUrls.length,
            });
        }

        // Compute addons subtotal using the shared helper so the cart summary,
        // order creation, and invoice all agree on the number. This must run
        // BEFORE discount calculation so percentage-based coupons apply to the
        // true line total (base × qty × fileMultiplier + addons) rather than
        // to the base subtotal alone.
        const addonMap = await fetchAddonRuleMap(collectAddonIds(orderItems));
        const addonsSubtotal = computeAddonsSubtotal(orderItems, addonMap);
        const grossSubtotal = subtotal + addonsSubtotal;

        // Calculate discount from coupon if provided
        let discountAmount = 0;
        let couponId = null;

        if (couponCode) {
            const coupon = await prisma.coupon.findUnique({
                where: { code: couponCode.toUpperCase() },
            });

            if (coupon && coupon.isActive) {
                const now = new Date();
                if (now >= coupon.validFrom && now <= coupon.validUntil) {
                    if (!coupon.minPurchaseAmount || grossSubtotal >= Number(coupon.minPurchaseAmount)) {
                        // Check usage limits
                        const usageCount = await prisma.couponUsage.count({
                            where: { couponId: coupon.id },
                        });

                        if (coupon.usageLimit === null || usageCount < coupon.usageLimit) {
                            const userUsageCount = await prisma.couponUsage.count({
                                where: {
                                    couponId: coupon.id,
                                    userId: req.user.id,
                                },
                            });

                            if (userUsageCount < coupon.usageLimitPerUser) {
                                // Calculate discount against the full line total
                                // (base × qty × fileMultiplier + addons) so
                                // addons receive the same percentage relief as
                                // the base price.
                                if (coupon.discountType === "PERCENTAGE") {
                                    discountAmount = (grossSubtotal * Number(coupon.discountValue)) / 100;
                                } else {
                                    discountAmount = Number(coupon.discountValue);
                                }

                                // Apply max discount cap
                                if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
                                    discountAmount = Number(coupon.maxDiscountAmount);
                                }

                                // Never discount more than the order is worth.
                                if (discountAmount > grossSubtotal) {
                                    discountAmount = grossSubtotal;
                                }

                                couponId = coupon.id;
                            }
                        }
                    }
                }
            }
        }

        // Enforce per-category minimum cart value before committing the order.
        // Re-use the shared addon helper so the rule honours
        // fileMultiplier / page-range gates exactly the same way the invoice
        // math does — the per-category subtotal we compare against the
        // minimum matches the amount the customer actually pays for that
        // category, which is what the cart UI preview also displays.
        const shortfallLines: CategoryLineContribution[] = orderItems.map((oi, index) => {
            let lineAddonTotal = 0;
            for (const addonId of oi.addons) {
                const rule = addonMap.get(addonId);
                if (!rule) continue;
                lineAddonTotal += computeAddonLineTotal(rule, oi);
            }
            return {
                productId: oi.productId,
                lineTotal: (lineBaseTotals[index] ?? 0) + lineAddonTotal,
            };
        });
        const categoryShortfalls = await computeCategoryCartShortfalls(shortfallLines);
        if (categoryShortfalls.length > 0) {
            throw new CartMinimumError(categoryShortfalls);
        }

        // Calculate final total (subtotal + addonsSubtotal - discount + shipping).
        // When a shippingMethodId resolves, the method price is authoritative; the
        // client-supplied shippingCharges is only kept as a legacy fallback.
        // Clamp at 0 so an oversized discount can never persist a negative total.
        const finalShippingCharges = serverShippingCharges !== null
            ? serverShippingCharges
            : Number(shippingCharges) || 0;
        const total = Math.max(0, grossSubtotal - discountAmount + finalShippingCharges);

        // Create order
        const order = await prisma.order.create({
            data: {
                userId: req.user.id,
                addressId,
                subtotal,
                addonsSubtotal: addonsSubtotal > 0 ? addonsSubtotal : null,
                discountAmount: discountAmount > 0 ? discountAmount : null,
                shippingCharges: finalShippingCharges > 0 ? finalShippingCharges : null,
                shippingMethodId: resolvedShippingMethodId,
                total,
                paymentMethod,
                couponId,
                status: "PENDING_REVIEW",
                refundStatus: "NOT_REQUIRED",
                refundEligibleAmount: 0,
                items: {
                    create: orderItems.map((oi) => ({
                        productId: oi.productId,
                        variantId: oi.variantId,
                        quantity: oi.quantity,
                        price: oi.price,
                        customDesignUrl: oi.customDesignUrl,
                        customText: oi.customText,
                        hasAddon: oi.hasAddon,
                        metadata: oi.metadata ?? undefined,
                        ...(oi.addons && oi.addons.length > 0 && {
                            addons: { connect: oi.addons.map((id: string) => ({ id })) },
                        }),
                    })),
                },
                statusHistory: {
                    create: {
                        status: "PENDING_REVIEW",
                        comment: "Order created",
                    },
                },
            },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                statusHistory: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        // Files are uploaded directly to the final FTP location (orders/customer-orders/...)
        // No temp-to-final copy step is needed for FTP (unlike the legacy S3 flow).
        // We simply ensure any uploaded paths are persisted correctly on the order items.
        const fileMovePromises = order.items
            .map(async (orderItem, index) => {
                const item = orderItems[index];
                if (!item || !item.customDesignUrl || item.customDesignUrl.length === 0) {
                    return;
                }

                try {
                    const fileUrls = Array.isArray(item.customDesignUrl) ? item.customDesignUrl : [item.customDesignUrl];
                    const validKeys = fileUrls.filter((k): k is string => typeof k === "string" && k.trim() !== "");

                    if (validKeys.length > 0) {
                        await prisma.orderItem.update({
                            where: { id: orderItem.id },
                            data: { customDesignUrl: validKeys },
                        });
                    }
                } catch (error) {
                    console.error(`Failed to persist file paths for order item ${orderItem.id}:`, error);
                    // Non-critical – order creation should still succeed
                }
            });

        // Wait for all file path updates to complete
        await Promise.allSettled(fileMovePromises);

        // Record coupon usage if applied
        if (couponId) {
            await prisma.couponUsage.create({
                data: {
                    couponId,
                    userId: req.user.id,
                    orderId: order.id,
                },
            });
        }

        // Fetch updated order with final file keys
        const updatedOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                statusHistory: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        return sendSuccess(res, updatedOrder || order, "Order created successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Customer: Get my orders
export const getMyOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: { userId: req.user.id },
                include: {
                    items: {
                        include: {
                            product: true,
                            variant: true,
                            addons: true,
                        },
                    },
                    address: true,
                    refunds: {
                        orderBy: { requestedAt: "desc" },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.order.count({
                where: { userId: req.user.id },
            }),
        ]);

        return sendSuccess(res, {
            orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Customer: Get order details
export const getOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { id } = req.params;

        const order = await prisma.order.findFirst({
            where: {
                id: id as string,
                userId: req.user.id,
            },
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
                            },
                        },
                        variant: true,
                        addons: true,
                    },
                },
                address: true,
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                },
                payments: true,
                refunds: {
                    orderBy: { requestedAt: "desc" },
                },
                shippingMethod: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        estimatedDays: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Build public FTP URLs for order files (files are publicly accessible via pagz.in)
        const orderWithFiles = {
            ...order,
            items: order.items.map((item) => {
                // Handle both array and single string for backward compatibility
                const fileUrls = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl
                    : item.customDesignUrl
                    ? [item.customDesignUrl]
                    : [];

                if (fileUrls.length > 0) {
                    // For FTP-hosted files, construct public URLs directly (no presigning needed)
                    const publicUrls = fileUrls.map((fileUrl) => {
                        if (typeof fileUrl !== "string") return "";
                        return getPublicFtpUrl(extractFtpPathFromUrl(fileUrl));
                    });

                    return {
                        ...item,
                        customDesignUrl: fileUrls,
                        customDesignPresignedUrls: publicUrls, // Public FTP URLs (replaces presigned S3 URLs)
                    };
                }
                return item;
            }),
        };

        return sendSuccess(res, orderWithFiles);
    } catch (error) {
        next(error);
    }
}

// Customer: Cancel own order
export const cancelMyOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { id } = req.params;
        const { reason, comment } = req.body as { reason?: string; comment?: string };

        if (!reason || !reason.trim()) {
            throw new ValidationError("Cancellation reason is required");
        }

        const order = await prisma.order.findFirst({
            where: {
                id: id as string,
                userId: req.user.id,
            },
            include: {
                payments: {
                    where: { status: "SUCCESS" },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        if (order.status === "CANCELLED") {
            throw new ValidationError("Order is already cancelled");
        }

        if (!CUSTOMER_CANCELLABLE_STATUSES.has(order.status)) {
            throw new ValidationError("This order can no longer be cancelled");
        }

        const refundDefaults = getOrderRefundDefaults(order);
        const statusComment = comment?.trim() || `Order cancelled by customer. Reason: ${reason.trim()}`;

        const updatedOrder = await prisma.$transaction(async (tx) => {
            const cancelled = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: "CANCELLED",
                    cancelledAt: new Date(),
                    cancelledBy: "CUSTOMER",
                    cancellationReason: reason.trim(),
                    refundStatus: refundDefaults.refundStatus,
                    refundEligibleAmount: refundDefaults.refundEligibleAmount,
                    refundFailureReason: null,
                },
                include: {
                    items: { include: { product: true, variant: true, addons: true } },
                    address: true,
                    payments: true,
                    refunds: {
                        orderBy: { requestedAt: "desc" },
                    },
                    statusHistory: {
                        orderBy: { createdAt: "asc" },
                    },
                },
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: order.id,
                    status: "CANCELLED",
                    comment: statusComment,
                },
            });

            return cancelled;
        });

        return sendSuccess(res, {
            order: updatedOrder,
            refundStatus: updatedOrder.refundStatus,
            timelineMessage: REFUND_TIMELINE_MESSAGE,
        }, "Order cancelled successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/orders:
 *   get:
 *     summary: Get all orders (admin)
 *     description: >
 *       Returns a paginated list of orders for admin users. Supports filtering by status and
 *       free-text search over order ID, customer email, and customer name.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING_REVIEW, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
 *       - name: search
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by order ID, customer email, or customer name (case-insensitive).
 *     responses:
 *       200:
 *         description: List of orders retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   required:
 *                     - orders
 *                     - pagination
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           total:
 *                             type: number
 *                           status:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                                 format: email
 *                               name:
 *                                 type: string
 *                                 nullable: true
 *                           address:
 *                             type: object
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized - admin authentication required.
 *       403:
 *         description: Forbidden - user is not an admin.
 */
// Admin: Get all orders
export const getAdminOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const status = req.query.status as string | string[];
        const paymentStatus = req.query.paymentStatus as string | string[];
        const paymentMethod = req.query.paymentMethod as string;
        const search = req.query.search as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;
        const updatedFrom = req.query.updatedFrom as string;
        const updatedTo = req.query.updatedTo as string;
        const minAmount = req.query.minAmount as string;
        const maxAmount = req.query.maxAmount as string;
        const customerId = req.query.customerId as string;
        const productId = req.query.productId as string;
        const couponId = req.query.couponId as string;
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) || 'desc';

        const where: any = {};

        // Status filter (supports array for multi-select)
        if (status) {
            if (Array.isArray(status)) {
                where.status = { in: status };
            } else {
                where.status = status;
            }
        }

        // Payment status filter (supports array)
        if (paymentStatus) {
            if (Array.isArray(paymentStatus)) {
                where.paymentStatus = { in: paymentStatus };
            } else {
                where.paymentStatus = paymentStatus;
            }
        }

        // Payment method filter
        if (paymentMethod) {
            where.paymentMethod = paymentMethod;
        }

        // Date range filters
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }

        // Updated date range filters
        if (updatedFrom || updatedTo) {
            where.updatedAt = {};
            if (updatedFrom) {
                where.updatedAt.gte = new Date(updatedFrom);
            }
            if (updatedTo) {
                where.updatedAt.lte = new Date(updatedTo);
            }
        }

        // Amount range filters
        if (minAmount || maxAmount) {
            where.total = {};
            if (minAmount) {
                where.total.gte = parseFloat(minAmount);
            }
            if (maxAmount) {
                where.total.lte = parseFloat(maxAmount);
            }
        }

        // Customer filter
        if (customerId) {
            where.userId = customerId;
        }

        // Product filter (orders containing specific product)
        if (productId) {
            where.items = {
                some: {
                    productId: productId,
                },
            };
        }

        // Coupon filter
        if (couponId) {
            if (couponId === 'null' || couponId === 'none') {
                where.couponId = null;
            } else {
                where.couponId = couponId;
            }
        }

        // Search functionality - search by order ID, user email, user name, phone, product name, address, PhonePe IDs
        if (search) {
            const searchConditions: any[] = [
                { id: { contains: search } },
                { phonePeOrderId: { contains: search } },
                {
                    user: {
                        OR: [
                            { email: { contains: search } },
                            { name: { contains: search } },
                            { phone: { contains: search } },
                        ],
                    },
                },
                {
                    address: {
                        OR: [
                            { city: { contains: search } },
                            { state: { contains: search } },
                            { zipCode: { contains: search } },
                        ],
                    },
                },
                {
                    items: {
                        some: {
                            product: {
                                name: { contains: search },
                            },
                        },
                    },
                },
                {
                    payments: {
                        some: {
                            phonePeTransactionId: { contains: search },
                        },
                    },
                },
            ];

            where.OR = searchConditions;
        }

        // Sorting
        const orderBy: any = {};
        if (sortBy === 'total') {
            orderBy.total = sortOrder;
        } else if (sortBy === 'status') {
            orderBy.status = sortOrder;
        } else if (sortBy === 'paymentStatus') {
            orderBy.paymentStatus = sortOrder;
        } else if (sortBy === 'customerName') {
            orderBy.user = {
                name: sortOrder,
            };
        } else if (sortBy === 'updatedAt') {
            orderBy.updatedAt = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            phone: true,
                        },
                    },
                    items: {
                        include: {
                            product: {
                                include: {
                                    images: {
                                        where: { isPrimary: true },
                                        take: 1,
                                    },
                                },
                            },
                            variant: true,
                            addons: true,
                        },
                    },
                    address: true,
                    payments: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                    },
                    refunds: {
                        take: 1,
                        orderBy: { requestedAt: "desc" },
                    },
                    statusHistory: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                    },
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.order.count({ where }),
        ]);

        return sendSuccess(res, {
            orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Admin: Get order details
export const getAdminOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        phone: true,
                    },
                },
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
                            },
                        },
                        variant: true,
                        addons: true,
                    },
                },
                address: true,
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                },
                payments: true,
                refunds: {
                    orderBy: { requestedAt: "desc" },
                },
                shippingMethod: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        estimatedDays: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Build public FTP URLs for order files (admin view, files are publicly accessible via pagz.in)
        const orderWithFiles = {
            ...order,
            items: order.items.map((item) => {
                // Handle both array and single string for backward compatibility
                const fileUrls = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl
                    : item.customDesignUrl
                    ? [item.customDesignUrl]
                    : [];

                if (fileUrls.length > 0) {
                    // For FTP-hosted files, construct public URLs directly (no presigning needed)
                    const publicUrls = fileUrls.map((fileUrl) => {
                        if (typeof fileUrl !== "string") return "";
                        return getPublicFtpUrl(extractFtpPathFromUrl(fileUrl));
                    });

                    return {
                        ...item,
                        customDesignUrl: fileUrls,
                        customDesignPresignedUrls: publicUrls, // Public FTP URLs (replaces presigned S3 URLs)
                    };
                }
                return item;
            }),
        };

        return sendSuccess(res, orderWithFiles);
    } catch (error) {
        next(error);
    }
};

// Admin: Update order status
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status, comment } = req.body;

        const validStatuses = [
            "PENDING_REVIEW",
            "ACCEPTED",
            "REJECTED",
            "PROCESSING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
        ];

        if (!id) throw new ValidationError('There is not id in params')

        if (!status || !validStatuses.includes(status)) {
            throw new ValidationError(`Status must be one of: ${validStatuses.join(", ")}`);
        }

        const order = await prisma.order.findUnique({
            where: { id: id as string },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Update order status
        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: { status },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        // Create status history entry
        await prisma.orderStatusHistory.create({
            data: {
                orderId: id as string,
                status,
                comment: comment || `Status updated to ${status}`,
            },
        });

        return sendSuccess(res, updatedOrder, "Order status updated successfully");
    } catch (error) {
        next(error);
    }
};

// Public/Customer: Track order
export const trackOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { email, phone } = req.query;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                user: {
                    select: {
                        email: true,
                        phone: true,
                    },
                },
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // If not authenticated, verify with email/phone
        if (!req.user) {
            if (email && order.user.email !== email) {
                throw new UnauthorizedError("Email does not match");
            }
            if (phone && order.user.phone !== phone) {
                throw new UnauthorizedError("Phone does not match");
            }
            if (!email && !phone) {
                throw new ValidationError("Email or phone required for public tracking");
            }
        } else if (req.user.id !== order.userId) {
            throw new UnauthorizedError("Not authorized to view this order");
        }

        return sendSuccess(res, {
            orderId: order.id,
            status: order.status,
            timeline: order.statusHistory,
        });
    } catch (error) {
        next(error);
    }
};

// Admin: Update order
export const updateOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { addressId, shippingCharges, discountAmount, items } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Cannot edit if order is shipped or delivered
        if (order.status === "SHIPPED" || order.status === "DELIVERED") {
            throw new ValidationError("Cannot edit order that is already shipped or delivered");
        }

        const updateData: any = {};

        if (addressId) {
            updateData.addressId = addressId;
        }

        if (shippingCharges !== undefined) {
            updateData.shippingCharges = parseFloat(shippingCharges);
        }

        if (discountAmount !== undefined) {
            updateData.discountAmount = parseFloat(discountAmount);
        }

        // Recalculate total if amounts changed
        if (updateData.shippingCharges !== undefined || updateData.discountAmount !== undefined) {
            const subtotal = Number(order.subtotal || 0);
            const addonsSubtotal = Number(order.addonsSubtotal || 0);
            const finalShipping = updateData.shippingCharges !== undefined
                ? updateData.shippingCharges
                : Number(order.shippingCharges || 0);
            const finalDiscount = updateData.discountAmount !== undefined
                ? updateData.discountAmount
                : Number(order.discountAmount || 0);
            // Clamp at 0: an admin-set discount larger than the order value
            // must not persist a negative grand total.
            updateData.total = Math.max(
                0,
                subtotal + addonsSubtotal - finalDiscount + finalShipping,
            );
        }

        // Update items if provided
        if (items && Array.isArray(items) && id) {
            // Delete existing items and create new ones
            await prisma.orderItem.deleteMany({
                where: { orderId: id as string },
            });

            // OPTIMIZATION: Fetch all products in parallel instead of sequentially
            const productIds = items.map(item => item.productId).filter(Boolean);
            const uniqueProductIds = [...new Set(productIds)];

            // Fetch all products in a single query (parallel)
            const products = await prisma.product.findMany({
                where: {
                    id: { in: uniqueProductIds },
                },
                include: {
                    variants: true,
                },
            });

            // Create a map for O(1) lookup
            const productMap = new Map(products.map(p => [p.id, p]));

            const orderItems = [];
            const orderIdString = id as string;
            for (const item of items) {
                const { productId, variantId, quantity, customDesignUrl, customText } = item;

                const product = productMap.get(productId);

                if (!product) {
                    throw new NotFoundError(`Product ${productId} not found`);
                }

                let itemPrice = Number(product.sellingPrice || product.basePrice);
                if (variantId) {
                    const variant = product.variants.find((v: { id: string }) => v.id === variantId);
                    if (variant) {
                        itemPrice += Number(variant.priceModifier);
                    }
                }

                orderItems.push({
                    orderId: orderIdString,
                    productId,
                    variantId: variantId || null,
                    quantity,
                    price: itemPrice,
                    customDesignUrl: customDesignUrl ? (Array.isArray(customDesignUrl) ? customDesignUrl : [customDesignUrl]) : [],
                    customText: customText || null,
                });
            }

            await prisma.orderItem.createMany({
                data: orderItems,
            });

            // Recalculate subtotal from items (base price only)
            const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            updateData.subtotal = subtotal;

            // Recalculate addonsSubtotal if items have addons
            // Note: This requires fetching the order items with addons relation after creation
            // For now, we'll set it to null and it can be recalculated on next order fetch
            // In a production system, you'd want to properly recalculate this
            updateData.addonsSubtotal = null; // Will be recalculated when order is fetched

            // Recalculate total (using existing addonsSubtotal if available)
            const finalShipping = updateData.shippingCharges !== undefined
                ? updateData.shippingCharges
                : Number(order.shippingCharges || 0);
            const finalDiscount = updateData.discountAmount !== undefined
                ? updateData.discountAmount
                : Number(order.discountAmount || 0);
            const existingAddonsSubtotal = Number(order.addonsSubtotal || 0);
            // Clamp at 0 so admin edits can't push the stored total below 0.
            updateData.total = Math.max(
                0,
                subtotal + existingAddonsSubtotal - finalDiscount + finalShipping,
            );
        }

        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        phone: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            include: {
                                category: true,
                                images: true,
                            },
                        },
                        variant: true,
                    },
                },
                address: true,
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                },
                payments: true,
            },
        });

        return sendSuccess(res, updatedOrder, "Order updated successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Cancel order
export const cancelOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { reason, comment } = req.body;

        if (!reason) {
            throw new ValidationError("Cancellation reason is required");
        }

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                payments: {
                    where: { status: "SUCCESS" },
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        if (order.status === "CANCELLED") {
            throw new ValidationError("Order is already cancelled");
        }

        const refundDefaults = getOrderRefundDefaults(order);
        const updatedOrder = await prisma.$transaction(async (tx) => {
            const cancelled = await tx.order.update({
                where: { id: id as string },
                data: {
                    status: "CANCELLED",
                    cancelledAt: new Date(),
                    cancelledBy: "ADMIN",
                    cancellationReason: reason.trim(),
                    refundStatus: refundDefaults.refundStatus,
                    refundEligibleAmount: refundDefaults.refundEligibleAmount,
                    refundFailureReason: null,
                },
                include: {
                    user: true,
                    items: {
                        include: {
                            product: true,
                            variant: true,
                        },
                    },
                    address: true,
                    statusHistory: true,
                    payments: true,
                    refunds: {
                        orderBy: { requestedAt: "desc" },
                    },
                },
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: id as string,
                    status: "CANCELLED",
                    comment: comment?.trim() || `Order cancelled by admin. Reason: ${reason.trim()}`,
                },
            });

            return cancelled;
        });

        return sendSuccess(res, updatedOrder, "Order cancelled successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Get order statistics
export const getOrderStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        const where: any = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Total orders
        const [totalOrders, todayOrders, weekOrders, monthOrders] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.count({ where: { ...where, createdAt: { gte: todayStart } } }),
            prisma.order.count({ where: { ...where, createdAt: { gte: weekStart } } }),
            prisma.order.count({ where: { ...where, createdAt: { gte: monthStart } } }),
        ]);

        // Total revenue
        const [totalRevenue, todayRevenue, weekRevenue, monthRevenue] = await Promise.all([
            prisma.order.aggregate({
                where: { ...where, paymentStatus: "SUCCESS" },
                _sum: { total: true },
            }),
            prisma.order.aggregate({
                where: { ...where, paymentStatus: "SUCCESS", createdAt: { gte: todayStart } },
                _sum: { total: true },
            }),
            prisma.order.aggregate({
                where: { ...where, paymentStatus: "SUCCESS", createdAt: { gte: weekStart } },
                _sum: { total: true },
            }),
            prisma.order.aggregate({
                where: { ...where, paymentStatus: "SUCCESS", createdAt: { gte: monthStart } },
                _sum: { total: true },
            }),
        ]);

        // Orders by status
        const ordersByStatus = await prisma.order.groupBy({
            by: ["status"],
            where,
            _count: { status: true },
        });

        // Pending payments count
        const pendingPaymentsCount = await prisma.order.count({
            where: { ...where, paymentStatus: "PENDING" },
        });

        // Average order value
        const avgOrderValue = await prisma.order.aggregate({
            where: { ...where, paymentStatus: "SUCCESS" },
            _avg: { total: true },
        });

        // Orders requiring attention
        const ordersRequiringAttention = await prisma.order.count({
            where: {
                ...where,
                OR: [
                    { status: "PENDING_REVIEW" },
                    { paymentStatus: "FAILED" },
                ],
            },
        });

        return sendSuccess(res, {
            totalOrders,
            orders: {
                today: todayOrders,
                week: weekOrders,
                month: monthOrders,
            },
            totalRevenue: Number(totalRevenue._sum.total || 0),
            revenue: {
                today: Number(todayRevenue._sum.total || 0),
                week: Number(weekRevenue._sum.total || 0),
                month: Number(monthRevenue._sum.total || 0),
            },
            ordersByStatus: ordersByStatus.map((item) => ({
                status: item.status,
                count: item._count.status,
            })),
            pendingPaymentsCount,
            averageOrderValue: Number(avgOrderValue._avg.total || 0),
            ordersRequiringAttention,
        });
    } catch (error) {
        next(error);
    }
};

// Admin: Mark payment as paid
export const markPaymentAsPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { amount, reference, date } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                payments: true,
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        if (order.paymentMethod !== "OFFLINE") {
            throw new ValidationError("Can only mark offline payments as paid");
        }

        const paymentAmount = amount ? parseFloat(amount) : Number(order.total);

        // Create or update payment
        let payment;
        const existingPayment = order.payments?.find((p) => p.method === "OFFLINE");

        if (existingPayment) {
            payment = await prisma.payment.update({
                where: { id: existingPayment.id },
                data: {
                    amount: paymentAmount,
                    status: "SUCCESS",
                    updatedAt: date ? new Date(date) : new Date(),
                },
            });
        } else {
            if (!id) {
                throw new ValidationError("Order ID is required");
            }
            payment = await prisma.payment.create({
                data: {
                    orderId: id as string,
                    userId: order.userId,
                    amount: paymentAmount,
                    method: "OFFLINE",
                    status: "SUCCESS",
                    createdAt: date ? new Date(date) : new Date(),
                },
            });
        }

        // Update order payment status
        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: { paymentStatus: "SUCCESS" },
            include: {
                user: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                payments: true,
            },
        });

        return sendSuccess(res, updatedOrder, "Payment marked as paid successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Process refund
export const processRefund = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { amount, reason, adminNote } = req.body as { amount?: number | string; reason?: string; adminNote?: string };

        const razorKeyId = process.env.RAZOR_LIVE_ID;
        const razorKeySecret = process.env.RAZOR_LIVE_SECRET_KEY;
        if (!razorKeyId || !razorKeySecret) {
            throw new AppError("Razorpay is not configured", 500);
        }

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                payments: {
                    where: { status: { in: ["SUCCESS", "REFUNDED"] } },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
                refunds: {
                    orderBy: { requestedAt: "desc" },
                },
            },
        });
        if (!order) throw new NotFoundError("Order not found");
        if (order.status !== "CANCELLED") throw new ValidationError("Only cancelled orders can be refunded");
        if (order.paymentMethod !== "ONLINE" || order.paymentStatus === "FAILED") {
            throw new ValidationError("Refund is only allowed for successful prepaid orders");
        }
        if (order.refundStatus === "PROCESSING" || order.refundStatus === "PROCESSED") {
            throw new ValidationError("Refund is already being processed or completed");
        }

        const payment = order.payments[0];
        if (!payment) throw new ValidationError("No successful payment found for this order");

        const paymentDetails = (payment.paymentDetails || {}) as Record<string, any>;
        const gatewayPaymentId = payment.gatewayPaymentId || paymentDetails.razorpayPaymentId || payment.phonePeTransactionId;
        if (!gatewayPaymentId) {
            throw new ValidationError("Gateway payment reference is missing for this order");
        }

        const totalPaid = Number(payment.amount || 0);
        const alreadyRefunded = Number(payment.refundedAmount || 0);
        const maxRefundable = Math.max(0, totalPaid - alreadyRefunded);
        if (maxRefundable <= 0) {
            throw new ValidationError("Refund already completed for this payment");
        }

        const requestedAmount = amount !== undefined ? Number(amount) : Number(order.refundEligibleAmount || maxRefundable);
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            throw new ValidationError("Refund amount must be greater than zero");
        }
        if (requestedAmount > maxRefundable) {
            throw new ValidationError(`Refund amount cannot exceed refundable amount (${maxRefundable})`);
        }

        const processingRefund = await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: order.id },
                data: {
                    refundStatus: "PROCESSING",
                    refundFailureReason: null,
                },
            });

            return tx.refund.create({
                data: {
                    orderId: order.id,
                    paymentId: payment.id,
                    gateway: "RAZORPAY",
                    amount: requestedAmount,
                    status: "PROCESSING",
                    reason: reason?.trim() || null,
                    adminNote: adminNote?.trim() || null,
                    requestedByAdminId: req.user?.id || null,
                },
            });
        });

        const auth = Buffer.from(`${razorKeyId}:${razorKeySecret}`).toString("base64");
        const razorResponse = await fetch(`https://api.razorpay.com/v1/payments/${gatewayPaymentId}/refund`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
                amount: Math.round(requestedAmount * 100),
                notes: {
                    orderId: order.id,
                    reason: reason || "Customer cancellation refund",
                    adminNote: adminNote || "",
                },
            }),
        });

        const razorData = await razorResponse.json() as Record<string, any>;
        if (!razorResponse.ok || !razorData?.id) {
            const failureReason = razorData?.error?.description || razorData?.error?.reason || "Razorpay refund API failed";
            await prisma.$transaction(async (tx) => {
                await tx.refund.update({
                    where: { id: processingRefund.id },
                    data: {
                        status: "FAILED",
                        failureReason,
                        gatewayPayload: razorData,
                    },
                });
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        refundStatus: "FAILED",
                        refundFailureReason: failureReason,
                    },
                });
            });
            throw new ValidationError(failureReason);
        }

        const newRefundedAmount = alreadyRefunded + requestedAmount;
        const isFullRefund = newRefundedAmount >= totalPaid;

        const updatedOrder = await prisma.$transaction(async (tx) => {
            await tx.refund.update({
                where: { id: processingRefund.id },
                data: {
                    status: "PROCESSED",
                    gatewayRefundId: String(razorData.id),
                    processedAt: new Date(),
                    gatewayPayload: razorData,
                },
            });

            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    refundedAmount: newRefundedAmount,
                    status: isFullRefund ? "REFUNDED" : payment.status,
                },
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: order.id,
                    status: "CANCELLED",
                    comment: `Refund processed via Razorpay. RefundId: ${String(razorData.id)}`,
                },
            });

            return tx.order.update({
                where: { id: order.id },
                data: {
                    refundStatus: "PROCESSED",
                    refundProcessedAt: new Date(),
                    refundFailureReason: null,
                    paymentStatus: isFullRefund ? "REFUNDED" : order.paymentStatus,
                },
                include: {
                    user: true,
                    items: {
                        include: {
                            product: true,
                            variant: true,
                        },
                    },
                    address: true,
                    payments: true,
                    refunds: {
                        orderBy: { requestedAt: "desc" },
                    },
                },
            });
        });

        return sendSuccess(res, updatedOrder, "Refund processed successfully"); 
    } catch (error) {
        next(error);
    }
};

// Admin: Get payment details
export const getPaymentDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                payments: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        return sendSuccess(res, {
            orderId: order.id,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            payments: order.payments,
            total: order.total,
        });
    } catch (error) {
        next(error);
    }
};

// Admin: Update tracking
export const updateTracking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { trackingNumber, carrier, shippingDate } = req.body;

        if (!trackingNumber) {
            throw new ValidationError("Tracking number is required");
        }

        const order = await prisma.order.findUnique({
            where: { id: id as string },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Store tracking info in order metadata (we'll use a JSON field or extend schema)
        // For now, we'll just update status to SHIPPED if not already
        const updateData: any = {};

        if (order.status !== "SHIPPED") {
            updateData.status = "SHIPPED";
        }

        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: updateData,
            include: {
                user: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                statusHistory: true,
            },
        });

        // Create status history entry
        if (id) {
            await prisma.orderStatusHistory.create({
                data: {
                    orderId: id as string,
                    status: "SHIPPED",
                    comment: `Tracking number: ${trackingNumber}${carrier ? `, Carrier: ${carrier}` : ""}`,
                },
            });
        }

        // Note: In production, you'd want to store trackingNumber and carrier in the database
        // This might require a schema migration to add a Tracking model or JSON field

        return sendSuccess(res, {
            ...updatedOrder,
            trackingNumber,
            carrier,
        }, "Tracking updated successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Mark as shipped
export const markAsShipped = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { trackingNumber, carrier, shippingDate } = req.body;

        if (!trackingNumber) {
            throw new ValidationError("Tracking number is required");
        }

        const order = await prisma.order.findUnique({
            where: { id: id as string },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: { status: "SHIPPED" },
            include: {
                user: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                statusHistory: true,
            },
        });

        if (id) {
            await prisma.orderStatusHistory.create({
                data: {
                    orderId: id as string,
                    status: "SHIPPED",
                    comment: `Order shipped. Tracking: ${trackingNumber}${carrier ? `, Carrier: ${carrier}` : ""}`,
                },
            });
        }

        return sendSuccess(res, {
            ...updatedOrder,
            trackingNumber,
            carrier,
        }, "Order marked as shipped successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Mark as delivered
export const markAsDelivered = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { deliveryDate, notes } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: { status: "DELIVERED" },
            include: {
                user: true,
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
                address: true,
                statusHistory: true,
            },
        });

        if (id) {
            await prisma.orderStatusHistory.create({
                data: {
                    orderId: id as string,
                    status: "DELIVERED",
                    comment: notes || `Order delivered${deliveryDate ? ` on ${deliveryDate}` : ""}`,
                },
            });
        }

        return sendSuccess(res, updatedOrder, "Order marked as delivered successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Get order invoice (HTML)
export const getOrderInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            include: {
                                category: true,
                                images: {
                                    where: { isPrimary: true },
                                    take: 1,
                                },
                            },
                        },
                        variant: true,
                    },
                },
                address: true,
                payments: {
                    where: { status: "SUCCESS" },
                    take: 1,
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Generate invoice HTML
        const month = String(new Date(order.createdAt).getMonth() + 1);
        const monthPadded = month.length === 1 ? '0' + month : month;
        const invoiceNumber = `INV-${new Date(order.createdAt).getFullYear()}-${monthPadded}-${order.id.slice(0, 8).toUpperCase()}`;

        const invoiceHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceNumber}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .invoice-number {
            font-size: 16px;
            color: #666;
        }
        .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .detail-section h3 {
            margin-top: 0;
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        .detail-section p {
            margin: 5px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        .text-right {
            text-align: right;
        }
        .totals {
            margin-top: 20px;
            margin-left: auto;
            width: 300px;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
        }
        .totals-row.font-medium {
            font-weight: 500;
        }
        .totals-row.total {
            font-weight: bold;
            font-size: 18px;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div>
                <h1>Invoice</h1>
                <p class="invoice-number">${invoiceNumber}</p>
            </div>
            <div>
                <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                <p><strong>Order ID:</strong> ${order.id}</p>
            </div>
        </div>

        <div class="details">
            <div class="detail-section">
                <h3>Bill To:</h3>
                <p><strong>${order.user?.name || 'Customer'}</strong></p>
                <p>${order.user?.email || ''}</p>
                ${order.user?.phone ? `<p>${order.user.phone}</p>` : ''}
            </div>
            <div class="detail-section">
                <h3>Ship To:</h3>
                <p>${order.address?.street || ''}</p>
                <p>${order.address?.city || ''}, ${order.address?.state || ''} ${order.address?.zipCode || ''}</p>
                <p>${order.address?.country || ''}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${order.items.map((item: any) => `
                    <tr>
                        <td>
                            <strong>${item.product?.name || 'Product'}</strong>
                            ${item.variant ? `<br><small>Variant: ${item.variant.name}</small>` : ''}
                            ${item.customText ? `<br><small>Custom: ${item.customText}</small>` : ''}
                        </td>
                        <td>${item.quantity}</td>
                        <td class="text-right">₹${Number(item.price).toFixed(2)}</td>
                        <td class="text-right">₹${(Number(item.price) * item.quantity).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals">
            <div class="totals-row">
                <span>Base Price Subtotal:</span>
                <span>₹${Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            ${order.addonsSubtotal && Number(order.addonsSubtotal) > 0 ? `
            <div class="totals-row">
                <span>Addons Subtotal:</span>
                <span>₹${Number(order.addonsSubtotal).toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="totals-row font-medium">
                <span>Subtotal:</span>
                <span>₹${(Number(order.subtotal || 0) + Number(order.addonsSubtotal || 0)).toFixed(2)}</span>
            </div>
            ${order.discountAmount ? `
            <div class="totals-row">
                <span>Discount:</span>
                <span>-₹${Number(order.discountAmount).toFixed(2)}</span>
            </div>
            ` : ''}
            ${order.shippingCharges ? `
            <div class="totals-row">
                <span>Shipping:</span>
                <span>₹${Number(order.shippingCharges).toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
                <span>Total:</span>
                <span>₹${Number(order.total).toFixed(2)}</span>
            </div>
        </div>

        ${order.payments && order.payments.length > 0 && order.payments[0] ? `
        <div class="detail-section" style="margin-top: 30px;">
            <h3>Payment Information</h3>
            <p><strong>Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Status:</strong> ${order.paymentStatus}</p>
            ${order.payments[0].phonePeTransactionId ? `<p><strong>Payment ID:</strong> ${order.payments[0].phonePeTransactionId}</p>` : ''}
        </div>
        ` : ''}

        <div class="footer">
            <p>Thank you for your business!</p>
        </div>
    </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.send(invoiceHTML);
    } catch (error) {
        next(error);
    }
};

/**
 * Get order invoice as PDF
 * Works for both admin and customer (based on auth)
 */
export const getOrderInvoicePDF = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.type === "admin";

        // Fetch order with all necessary relations
        const order = await prisma.order.findUnique({
            where: { id: id as string },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                items: {
                    include: {
                        product: {
                            include: {
                                category: true,
                                images: {
                                    where: { isPrimary: true },
                                    take: 1,
                                },
                            },
                        },
                        variant: true,
                        addons: true, // CRITICAL: Include addons
                    },
                },
                address: true,
                payments: {
                    where: { status: "SUCCESS" },
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Verify access: customer can only access their own orders
        if (!isAdmin && order.userId !== req.user?.id) {
            throw new UnauthorizedError("You don't have access to this order");
        }

        // Calculate billing summary
        const baseSubtotal = order.subtotal !== null && order.subtotal !== undefined
            ? Number(order.subtotal)
            : order.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

        // Prefer the persisted total on the order so invoices always reflect
        // what was actually charged; fall back to re-computing from addons.
        const addonsSubtotal = order.addonsSubtotal !== null && order.addonsSubtotal !== undefined
            ? Number(order.addonsSubtotal)
            : order.items.reduce((sum, item) => {
                const addonRules: AddonPricingRule[] = Array.isArray((item as any).addons)
                    ? (item as any).addons
                    : [];
                const addonMap = new Map<string, AddonPricingRule>(
                    addonRules.map((r) => [r.id, r])
                );
                const itemFileCount = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl.length
                    : item.customDesignUrl ? 1 : 0;
                return sum + computeLineAddonsTotal(
                    {
                        quantity: item.quantity,
                        addons: addonRules.map((r) => r.id),
                        metadata: (item.metadata as any) ?? null,
                        fileCount: itemFileCount,
                    },
                    addonMap,
                );
            }, 0);

        const subtotal = baseSubtotal + addonsSubtotal;
        const discount = order.discountAmount ? Number(order.discountAmount) : 0;
        const shipping = order.shippingCharges ? Number(order.shippingCharges) : 0;
        const tax = 0; // Calculate tax if needed
        const total = Number(order.total);

        // Generate invoice number
        const month = String(new Date(order.createdAt).getMonth() + 1).padStart(2, '0');
        const invoiceNumber = `INV-${new Date(order.createdAt).getFullYear()}-${month}-${order.id.slice(0, 8).toUpperCase()}`;

        // Prepare invoice data
        const invoiceData = {
            invoiceNumber,
            orderDate: new Date(order.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
            orderId: order.id,
            customer: {
                name: order.user?.name || 'Customer',
                email: order.user?.email || '',
                phone: order.user?.phone || undefined,
            },
            shippingAddress: {
                street: order.address?.street || '',
                city: order.address?.city || '',
                state: order.address?.state || '',
                zipCode: order.address?.zipCode || '',
                country: order.address?.country || 'India',
            },
            items: order.items.map((item: any) => {
                const addons: AddonPricingRule[] = Array.isArray(item.addons) ? item.addons : [];
                const metadata = (item.metadata as any) ?? null;
                const lineFileCount = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl.length
                    : item.customDesignUrl ? 1 : 0;
                const line = {
                    quantity: item.quantity,
                    addons: addons.map((a) => a.id),
                    metadata,
                    fileCount: lineFileCount,
                };
                return {
                    name: item.product?.name || 'Product',
                    variant: item.variant?.name,
                    quantity: item.quantity,
                    price: Number(item.price),
                    total: Number(item.price) * item.quantity,
                    addons: addons.length > 0 ? addons.map((addon: any) => {
                        const specValues = (addon.specificationValues || {}) as Record<string, any>;
                        const addonName = Object.entries(specValues)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ') || 'Addon';
                        return {
                            name: addonName,
                            price: computeAddonLineTotal(addon, line),
                        };
                    }) : undefined,
                };
            }),
            billing: {
                baseSubtotal,
                addonsSubtotal,
                subtotal,
                discount,
                shipping,
                tax,
                total,
            },
            payment: {
                method: order.paymentMethod === 'ONLINE' ? 'Online Payment' : 'Cash on Delivery',
                status: order.paymentStatus,
                transactionId: order.payments?.[0]?.phonePeTransactionId || order.payments?.[0]?.phonePeOrderId || undefined,
            },
            company: {
                name: process.env.COMPANY_NAME || 'pagz',
                address: process.env.COMPANY_ADDRESS || 'Company Address',
                phone: process.env.COMPANY_PHONE || '+91 1234567890',
                email: process.env.COMPANY_EMAIL || 'info@pagz.com',
                gstin: process.env.COMPANY_GSTIN,
            },
        };

        // Generate PDF
        let pdfBuffer: Buffer;
        try {
            pdfBuffer = await generateInvoicePDF(invoiceData);
        } catch (pdfError) {
            console.error("[INVOICE_PDF] Failed to generate PDF:", {
                orderId: id,
                isAdmin,
                error: pdfError instanceof Error ? pdfError.message : pdfError,
            });
            // Return actionable error to client (still 500)
            throw new AppError(
                pdfError instanceof Error ? pdfError.message : "Failed to generate invoice PDF",
                500
            );
        }

        // Set response headers
        const filename = `Invoice-${invoiceNumber}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length.toString());

        return res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

// Admin: Export orders
export const exportOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const format = (req.query.format as string) || 'csv';
        const status = req.query.status as string | string[];
        const paymentStatus = req.query.paymentStatus as string | string[];
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;

        const where: any = {};

        // Apply filters similar to getAdminOrders
        if (status) {
            if (Array.isArray(status)) {
                where.status = { in: status };
            } else {
                where.status = status;
            }
        }

        if (paymentStatus) {
            if (Array.isArray(paymentStatus)) {
                where.paymentStatus = { in: paymentStatus };
            } else {
                where.paymentStatus = paymentStatus;
            }
        }

        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }

        // Fetch all matching orders (no pagination for export)
        const orders = await prisma.order.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        phone: true,
                    },
                },
                items: {
                    include: {
                        product: true,
                    },
                },
                address: true,
                payments: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (format === 'csv') {
            // Generate CSV
            const headers = [
                'Order ID',
                'Date',
                'Customer Name',
                'Customer Email',
                'Customer Phone',
                'Items Count',
                'Subtotal',
                'Discount',
                'Shipping',
                'Total',
                'Status',
                'Payment Status',
                'Payment Method',
                'Street',
                'City',
                'State',
                'Zip Code',
                'Country',
                'PhonePe Order ID',
                'Created At',
                'Updated At',
            ];

            const rows = orders.map(order => {
                const address = order.address;
                return [
                    order.id,
                    new Date(order.createdAt).toISOString(),
                    order.user?.name || '',
                    order.user?.email || '',
                    order.user?.phone || '',
                    order.items.length.toString(),
                    order.subtotal?.toString() || '0',
                    order.discountAmount?.toString() || '0',
                    order.shippingCharges?.toString() || '0',
                    order.total.toString(),
                    order.status,
                    order.paymentStatus,
                    order.paymentMethod,
                    address?.street || '',
                    address?.city || '',
                    address?.state || '',
                    address?.zipCode || '',
                    address?.country || '',
                    order.phonePeOrderId || '',
                    new Date(order.createdAt).toISOString(),
                    new Date(order.updatedAt).toISOString(),
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=orders-export-${new Date().toISOString().split('T')[0]}.csv`);
            return res.send(csvContent);
        } else {
            // JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=orders-export-${new Date().toISOString().split('T')[0]}.json`);
            return sendSuccess(res, { orders, total: orders.length });
        }
    } catch (error) {
        next(error);
    }
};

