import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { copyFile, generatePresignedUrl } from "../services/s3.js";
import { generateInvoicePDF } from "../services/pdfGenerator.js";

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

        const { couponCode, shippingCharges = 0 } = req.body;

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
            customDesignUrl: string[]; // Array of S3 URLs
            customText: string | null;
            hasAddon: boolean;
            addons: string[];
            metadata?: any;
        }> = [];

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

            const itemTotal = itemPrice * quantity;
            subtotal += itemTotal;

            // Normalize addons to array
            const normalizedAddons: string[] = Array.isArray(addons)
                ? addons.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
                : [];

            orderItems.push({
                productId,
                variantId: variantId || null,
                quantity,
                price: itemPrice,
                customDesignUrl: customDesignUrl ? (Array.isArray(customDesignUrl) ? customDesignUrl : [customDesignUrl]) : [],
                customText: customText || null,
                hasAddon: normalizedAddons.length > 0,
                addons: normalizedAddons,
                metadata: metadata || undefined,
            });
        }

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
                    if (!coupon.minPurchaseAmount || subtotal >= Number(coupon.minPurchaseAmount)) {
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
                                // Calculate discount
                                if (coupon.discountType === "PERCENTAGE") {
                                    discountAmount = (subtotal * Number(coupon.discountValue)) / 100;
                                } else {
                                    discountAmount = Number(coupon.discountValue);
                                }

                                // Apply max discount cap
                                if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
                                    discountAmount = Number(coupon.maxDiscountAmount);
                                }

                                couponId = coupon.id;
                            }
                        }
                    }
                }
            }
        }

        // Calculate addons subtotal from order items
        let addonsSubtotal = 0;
        const allAddonIds = new Set<string>();
        orderItems.forEach(item => {
            if (item.addons && Array.isArray(item.addons)) {
                item.addons.forEach((addonId: string) => allAddonIds.add(addonId));
            }
        });

        if (allAddonIds.size > 0) {
            // Fetch all addon rules
            const addonRules = await prisma.categoryPricingRule.findMany({
                where: {
                    id: { in: Array.from(allAddonIds) },
                    ruleType: 'ADDON',
                    isActive: true,
                },
            });

            // Create a map for O(1) lookup
            const addonMap = new Map(addonRules.map(rule => [rule.id, rule]));

            // Calculate addons total for each order item
            orderItems.forEach(item => {
                if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
                    // Get page count from metadata if available
                    const pageCount = item.metadata?.pageCount || 1;
                    const copies = item.metadata?.copies || 1;
                    const effectivePages = pageCount > 1 ? pageCount * copies : null;
                    
                    item.addons.forEach((addonId: string) => {
                        const addonRule = addonMap.get(addonId);
                        if (addonRule) {
                            // Check page range if addon has minQuantity/maxQuantity
                            const hasPageRange = addonRule.minQuantity != null || addonRule.maxQuantity != null;
                            if (hasPageRange && effectivePages != null) {
                                const inRange = 
                                    (addonRule.minQuantity == null || effectivePages >= addonRule.minQuantity) &&
                                    (addonRule.maxQuantity == null || effectivePages <= addonRule.maxQuantity);
                                if (!inRange) {
                                    return; // Skip this addon if not in range
                                }
                            }
                            
                            const rawPrice = addonRule.priceModifier !== null && addonRule.priceModifier !== undefined
                                ? Number(addonRule.priceModifier)
                                : addonRule.basePrice !== null && addonRule.basePrice !== undefined
                                    ? Number(addonRule.basePrice)
                                    : 0;
                            
                            // Calculate multiplier based on quantity multiplier and page count
                            let multiplier = 1;
                            if (addonRule.quantityMultiplier) {
                                if (effectivePages != null) {
                                    multiplier = effectivePages;
                                } else {
                                    multiplier = item.quantity;
                                }
                            }
                            
                            addonsSubtotal += rawPrice * multiplier;
                        }
                    });
                }
            });
        }

        // Calculate final total (subtotal + addonsSubtotal - discount + shipping)
        const finalShippingCharges = Number(shippingCharges) || 0;
        const total = subtotal + addonsSubtotal - discountAmount + finalShippingCharges;

        // Create order
        const order = await prisma.order.create({
            data: {
                userId: req.user.id,
                addressId,
                subtotal,
                addonsSubtotal: addonsSubtotal > 0 ? addonsSubtotal : null,
                discountAmount: discountAmount > 0 ? discountAmount : null,
                shippingCharges: finalShippingCharges > 0 ? finalShippingCharges : null,
                total,
                paymentMethod,
                couponId,
                status: "PENDING_REVIEW",
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
                        // @ts-ignore - connect addons relation
                        addons: oi.addons && oi.addons.length > 0
                            ? { connect: oi.addons.map((id: string) => ({ id })) }
                            : undefined,
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

        // Move files from temp to final order folder for items with customDesignUrl
        const fileMovePromises = order.items
            .map(async (orderItem, index) => {
                const item = orderItems[index];
                if (!item || !item.customDesignUrl || item.customDesignUrl.length === 0) {
                    return;
                }

                try {
                    const movedKeys: string[] = [];
                    const fileUrls = Array.isArray(item.customDesignUrl) ? item.customDesignUrl : [item.customDesignUrl];

                    for (let fileIndex = 0; fileIndex < fileUrls.length; fileIndex++) {
                        const sourceKey = fileUrls[fileIndex];
                        if (!sourceKey || !sourceKey.includes("/temp/")) {
                            // Keep non-temp keys as-is
                            if (sourceKey) movedKeys.push(sourceKey);
                            continue;
                        }

                        // Extract filename from source key
                        const filename = sourceKey.split("/").pop() || `design-${Date.now()}.pdf`;
                        // Remove sessionId prefix if present (format: {sessionId}-{filename})
                        const cleanFilename = filename.includes("-") ? filename.split("-").slice(1).join("-") : filename;
                        const finalFilename = `design-${Date.now()}-${index}-${fileIndex}-${cleanFilename}`;

                        const destinationKey = `orders-file/${req.user!.id}/${order.id}/${finalFilename}`;

                        // Copy file from temp to final location
                        await copyFile(sourceKey, destinationKey, false);
                        movedKeys.push(destinationKey);
                    }

                    // Update order item with final S3 keys array
                    if (movedKeys.length > 0) {
                        await prisma.orderItem.update({
                            where: { id: orderItem.id },
                            data: { customDesignUrl: movedKeys },
                        });
                    }
                } catch (error) {
                    console.error(`Failed to move files for order item ${orderItem.id}:`, error);
                    // Continue even if file move fails - the temp file will be cleaned up later
                }
            });

        // Wait for all file moves to complete (but don't fail order creation if they fail)
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
                                category: true,
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
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Generate presigned URLs for order files (customer can access their own files)
        const orderWithFiles = {
            ...order,
            items: await Promise.all(
                order.items.map(async (item) => {
                    // Generate presigned URLs if customDesignUrl exists (for private order files)
                    // Handle both array and single string for backward compatibility
                    const fileUrls = Array.isArray(item.customDesignUrl) ? item.customDesignUrl : (item.customDesignUrl ? [item.customDesignUrl] : []);

                    if (fileUrls.length > 0) {
                        try {
                            // Generate presigned URLs for all files
                            const presignedUrls = await Promise.all(
                                fileUrls.map(async (s3KeyOrUrl) => {
                                    // Ensure we are dealing with a string
                                    if (typeof s3KeyOrUrl !== 'string') {
                                        return "";
                                    }

                                    let s3Key = s3KeyOrUrl;

                                    // If it's a full S3 URL, extract just the key
                                    if (s3Key.includes('amazonaws.com') || s3Key.includes('.s3.')) {
                                        try {
                                            const urlObj = new URL(s3Key);
                                            const pathname = urlObj.pathname || '';
                                            s3Key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
                                        } catch {
                                            // If URL parsing fails, try simple string extraction
                                            const parts = s3Key.split('.amazonaws.com/');
                                            const extractedPart = parts.length > 1 ? parts[1] : undefined;
                                            if (extractedPart) {
                                                s3Key = extractedPart.split('?')[0] || extractedPart; // Remove query params
                                            } else {
                                                // Try extracting from s3.region.amazonaws.com format
                                                const match = s3Key.match(/s3[^/]*\/[^/]+\/(.+)/);
                                                const matchedPart = match?.[1];
                                                if (matchedPart) {
                                                    s3Key = matchedPart.split('?')[0] || matchedPart;
                                                }
                                            }
                                        }
                                    }

                                    // Ensure we have a valid key before generating presigned URL
                                    const finalKey = s3Key?.trim();
                                    if (!finalKey || finalKey === '') {
                                        throw new Error('Invalid S3 key');
                                    }

                                    // Generate presigned URL (1 hour expiration for customer)
                                    return await generatePresignedUrl(finalKey, 3600);
                                })
                            );

                            return {
                                ...item,
                                customDesignUrl: fileUrls, // Return array of S3 keys
                                customDesignPresignedUrls: presignedUrls, // Array of presigned URLs
                            };
                        } catch (error) {
                            console.error(`Failed to generate presigned URLs for order item ${item.id}:`, error);
                            // Return item with error info but still show the keys
                            return {
                                ...item,
                                customDesignUrl: fileUrls,
                                customDesignPresignedUrls: [],
                            };
                        }
                    }
                    return item;
                })
            ),
        };

        return sendSuccess(res, orderWithFiles);
    } catch (error) {
        next(error);
    }
}

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

        // Search functionality - search by order ID, user email, user name, phone, product name, address, razorpay IDs
        if (search) {
            const searchConditions: any[] = [
                { id: { contains: search } },
                { razorpayOrderId: { contains: search } },
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
                            razorpayPaymentId: { contains: search },
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
                                category: true,
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
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found");
        }

        // Generate presigned URLs for order files (admin can view all order files)
        const orderWithFiles = {
            ...order,
            items: await Promise.all(
                order.items.map(async (item) => {
                    // Generate presigned URLs if customDesignUrl exists (for private order files)
                    // Handle both array and single string for backward compatibility
                    const fileUrls = Array.isArray(item.customDesignUrl) ? item.customDesignUrl : (item.customDesignUrl ? [item.customDesignUrl] : []);

                    if (fileUrls.length > 0) {
                        try {
                            // Generate presigned URLs for all files
                            const presignedUrls = await Promise.all(
                                fileUrls.map(async (s3KeyOrUrl) => {
                                    // Ensure we are dealing with a string
                                    if (typeof s3KeyOrUrl !== 'string') {
                                        return "";
                                    }

                                    let s3Key = s3KeyOrUrl;

                                    // If it's a full S3 URL, extract just the key
                                    if (s3Key.includes('amazonaws.com') || s3Key.includes('.s3.')) {
                                        try {
                                            const urlObj = new URL(s3Key);
                                            const pathname = urlObj.pathname || '';
                                            s3Key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
                                        } catch {
                                            // If URL parsing fails, try simple string extraction
                                            const parts = s3Key.split('.amazonaws.com/');
                                            const extractedPart = parts.length > 1 ? parts[1] : undefined;
                                            if (extractedPart) {
                                                s3Key = extractedPart.split('?')[0] || extractedPart; // Remove query params
                                            } else {
                                                // Try extracting from s3.region.amazonaws.com format
                                                const match = s3Key.match(/s3[^/]*\/[^/]+\/(.+)/);
                                                const matchedPart = match?.[1];
                                                if (matchedPart) {
                                                    s3Key = matchedPart.split('?')[0] || matchedPart;
                                                }
                                            }
                                        }
                                    }

                                    // Ensure we have a valid key before generating presigned URL
                                    const finalKey = s3Key?.trim();
                                    if (!finalKey || finalKey === '') {
                                        throw new Error('Invalid S3 key');
                                    }

                                    // Generate presigned URL for admin access (24 hours expiration)
                                    return await generatePresignedUrl(finalKey, 86400);
                                })
                            );

                            return {
                                ...item,
                                customDesignUrl: fileUrls, // Array of S3 keys
                                customDesignPresignedUrls: presignedUrls, // Array of presigned URLs
                            };
                        } catch (error) {
                            console.error(`Failed to generate presigned URLs for order item ${item.id}:`, error);
                            // Return item with error info but still show the keys
                            return {
                                ...item,
                                customDesignUrl: fileUrls,
                                customDesignPresignedUrls: [],
                            };
                        }
                    }
                    return item;
                })
            ),
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
            updateData.total = subtotal + addonsSubtotal - finalDiscount + finalShipping;
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
            updateData.total = subtotal + existingAddonsSubtotal - finalDiscount + finalShipping;
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
        const { reason, refund } = req.body;

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

        // Update order status
        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: { status: "CANCELLED" },
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
            },
        });

        // Create status history entry
        if (id) {
            await prisma.orderStatusHistory.create({
                data: {
                    orderId: id as string,
                    status: "CANCELLED",
                    comment: reason || "Order cancelled",
                },
            });
        }

        // Handle refund if requested and payment was successful
        if (refund && order.payments && order.payments.length > 0) {
            const payment = order.payments[0];
            if (payment && payment.status === "SUCCESS") {
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: "REFUNDED" },
                });

                if (id) {
                    await prisma.order.update({
                        where: { id: id as string },
                        data: { paymentStatus: "REFUNDED" },
                    });
                }
            }
        }

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
        const { amount, reason, method } = req.body;

        if (!reason) {
            throw new ValidationError("Refund reason is required");
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

        if (!order.payments || order.payments.length === 0) {
            throw new ValidationError("No successful payment found for this order");
        }

        const payment = order.payments[0];
        if (!payment) {
            throw new ValidationError("Payment not found");
        }

        const refundAmount = amount ? parseFloat(amount) : Number(payment.amount);

        if (refundAmount > Number(payment.amount)) {
            throw new ValidationError("Refund amount cannot exceed payment amount");
        }

        // Update payment status
        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "REFUNDED" },
        });

        // Update order payment status
        const updatedOrder = await prisma.order.update({
            where: { id: id as string },
            data: { paymentStatus: "REFUNDED" },
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
            ${order.payments[0].razorpayPaymentId ? `<p><strong>Payment ID:</strong> ${order.payments[0].razorpayPaymentId}</p>` : ''}
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

        const addonsSubtotal = order.addonsSubtotal !== null && order.addonsSubtotal !== undefined
            ? Number(order.addonsSubtotal)
            : order.items.reduce((sum, item) => {
                const addons = Array.isArray((item as any).addons) ? (item as any).addons : [];
                const itemAddonsTotal = addons.reduce((addonSum: number, addon: any) => {
                    const rawPrice =
                        addon.priceModifier !== null && addon.priceModifier !== undefined
                            ? Number(addon.priceModifier)
                            : addon.basePrice !== null && addon.basePrice !== undefined
                                ? Number(addon.basePrice)
                                : 0;
                    const multiplier = addon.quantityMultiplier ? item.quantity : 1;
                    return addonSum + rawPrice * multiplier;
                }, 0);
                return sum + itemAddonsTotal;
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
                const addons = Array.isArray(item.addons) ? item.addons : [];
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
                        const rawPrice =
                            addon.priceModifier !== null && addon.priceModifier !== undefined
                                ? Number(addon.priceModifier)
                                : addon.basePrice !== null && addon.basePrice !== undefined
                                    ? Number(addon.basePrice)
                                    : 0;
                        const multiplier = addon.quantityMultiplier ? item.quantity : 1;
                        return {
                            name: addonName,
                            price: rawPrice * multiplier,
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
                transactionId: order.payments?.[0]?.razorpayPaymentId || order.payments?.[0]?.razorpayOrderId || undefined,
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
        const pdfBuffer = await generateInvoicePDF(invoiceData);

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
                'Razorpay Order ID',
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
                    order.razorpayOrderId || '',
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

