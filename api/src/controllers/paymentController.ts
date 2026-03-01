import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { initiatePhonePePayment, checkPhonePePaymentStatus, verifyPhonePeCallback, phonePeConfig } from "../services/phonepe.js";
import { prisma } from "../services/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";

// Create PhonePe order from cart data (redirect-based flow)
export const createPhonePeOrderFromCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { items, addressId, amount, couponCode, shippingCharges } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new ValidationError("Order items are required");
        }

        if (!addressId) {
            throw new ValidationError("Shipping address is required");
        }

        if (!amount || Number(amount) <= 0) {
            throw new ValidationError("Valid amount is required");
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

        if (!phonePeConfig.isConfigured) {
            return sendError(res, "PhonePe not configured", 500);
        }

        // Generate a unique merchant order ID
        const merchantOrderId = uuidv4().replace(/-/g, "").slice(0, 32);
        const amountInPaise = Math.round(Number(amount) * 100);

        // Save cart data to PendingPayment table (expires in 1 hour)
        await prisma.pendingPayment.create({
            data: {
                merchantOrderId,
                userId: req.user.id,
                addressId,
                items: JSON.parse(JSON.stringify(items)),
                amount: Number(amount),
                couponCode: couponCode || null,
                shippingCharges: shippingCharges ? Number(shippingCharges) : null,
                status: "PENDING",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            },
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3002}`;

        // Initiate PhonePe payment
        const { redirectUrl } = await initiatePhonePePayment({
            merchantTransactionId: merchantOrderId,
            amount: amountInPaise,
            redirectUrl: `${frontendUrl}/payment/callback?merchantOrderId=${merchantOrderId}`,
            callbackUrl: `${apiUrl}/api/webhooks/phonepe`,
            merchantUserId: req.user.id.slice(0, 36),
        });

        return sendSuccess(res, {
            redirectUrl,
            merchantOrderId,
        }, "PhonePe payment initiated successfully");
    } catch (error) {
        next(error);
    }
};

// Verify PhonePe payment and create order
export const verifyPhonePePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { merchantOrderId } = req.body;

        if (!merchantOrderId) {
            throw new ValidationError("merchantOrderId is required");
        }

        // Check payment status with PhonePe
        const statusResult = await checkPhonePePaymentStatus(merchantOrderId);

        if (statusResult.state !== "COMPLETED") {
            return sendSuccess(res, {
                verified: false,
                state: statusResult.state,
                message: statusResult.state === "PENDING" ? "Payment is still pending" : "Payment failed",
            }, statusResult.state === "PENDING" ? "Payment pending" : "Payment failed");
        }

        // Check if order already exists for this transaction
        const existingOrder = await prisma.order.findFirst({
            where: {
                phonePeOrderId: merchantOrderId,
                userId: req.user.id,
            },
        });

        if (existingOrder) {
            return sendSuccess(res, {
                verified: true,
                orderId: existingOrder.id,
            }, "Payment already verified");
        }

        // Fetch pending payment data
        const pendingPayment = await prisma.pendingPayment.findUnique({
            where: { merchantOrderId },
        });

        if (!pendingPayment) {
            throw new NotFoundError("Pending payment not found");
        }

        if (pendingPayment.userId !== req.user.id) {
            throw new UnauthorizedError("Payment does not belong to this user");
        }

        if (pendingPayment.status === "COMPLETED") {
            // Already processed - find the order
            const order = await prisma.order.findFirst({
                where: { phonePeOrderId: merchantOrderId },
            });
            return sendSuccess(res, {
                verified: true,
                orderId: order?.id,
            }, "Payment already verified");
        }

        // Parse items from pending payment
        const items = pendingPayment.items as any[];
        const addressId = pendingPayment.addressId;
        const couponCode = pendingPayment.couponCode;
        const shippingCharges = Number(pendingPayment.shippingCharges || 0);

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

        // Calculate order totals
        let subtotal = 0;
        const orderItems: Array<{
            productId: string;
            variantId: string | null;
            quantity: number;
            price: number;
            customDesignUrl: string[];
            customText: string | null;
            hasAddon: boolean;
            addons: string[];
            metadata?: any;
        }> = [];

        for (const item of items) {
            const { productId, variantId, quantity, customDesignUrl, customText, addons, metadata } = item;

            if (!productId || !quantity || quantity < 1) {
                throw new ValidationError("Invalid order item");
            }

            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: { variants: true, images: true },
            });

            if (!product || !product.isActive) {
                throw new NotFoundError(`Product ${productId} not found`);
            }

            let itemPrice = Number(product.sellingPrice || product.basePrice);

            if (variantId) {
                const variant = product.variants.find((v: { id: string }) => v.id === variantId);
                if (!variant || !variant.available) {
                    throw new ValidationError(`Variant ${variantId} not available`);
                }
                itemPrice += Number(variant.priceModifier);
            }

            // If metadata contains a full price breakdown (base + addons), use it to derive item price
            if (metadata && Array.isArray(metadata.priceBreakdown)) {
                const lineTotal = metadata.priceBreakdown.reduce(
                    (sum: number, entry: any) => sum + Number(entry?.value || 0),
                    0
                );
                if (quantity > 0 && lineTotal > 0) {
                    itemPrice = lineTotal / quantity;
                }
            }

            const itemTotal = itemPrice * quantity;
            subtotal += itemTotal;

            // Normalize customDesignUrl to array
            let normalizedUrls: string[] = [];
            if (customDesignUrl) {
                if (Array.isArray(customDesignUrl)) {
                    normalizedUrls = customDesignUrl.filter((url): url is string => typeof url === 'string' && url.length > 0);
                } else if (typeof customDesignUrl === 'string' && customDesignUrl.length > 0) {
                    normalizedUrls = [customDesignUrl];
                }
            }

            // Extract addons from item.addons if present, otherwise from metadata
            const selectedAddons: string[] = Array.isArray(item.addons)
                ? (item.addons as string[]).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
                : Array.isArray(metadata?.selectedAddons)
                    ? (metadata.selectedAddons as string[])
                    : [];

            orderItems.push({
                productId,
                variantId: variantId || null,
                quantity,
                price: itemPrice,
                customDesignUrl: normalizedUrls,
                customText: customText || null,
                hasAddon: selectedAddons.length > 0,
                addons: selectedAddons,
                metadata: metadata || undefined,
            });
        }

        // Calculate discount from coupon if provided
        let discountAmount = 0;
        let couponId = null;

        if (couponCode && couponCode.trim()) {
            const coupon = await prisma.coupon.findUnique({
                where: { code: String(couponCode).toUpperCase() },
            });

            if (coupon && coupon.isActive) {
                const now = new Date();
                if (now >= coupon.validFrom && now <= coupon.validUntil) {
                    if (!coupon.minPurchaseAmount || subtotal >= Number(coupon.minPurchaseAmount)) {
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
                                if (coupon.discountType === "PERCENTAGE") {
                                    discountAmount = (subtotal * Number(coupon.discountValue)) / 100;
                                } else {
                                    discountAmount = Number(coupon.discountValue);
                                }

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
        const total = subtotal + addonsSubtotal - discountAmount + shippingCharges;

        // Create order
        const order = await prisma.order.create({
            data: {
                userId: req.user.id,
                addressId,
                subtotal,
                addonsSubtotal: addonsSubtotal > 0 ? addonsSubtotal : null,
                discountAmount: discountAmount > 0 ? discountAmount : null,
                shippingCharges: shippingCharges > 0 ? shippingCharges : null,
                total,
                paymentMethod: "ONLINE",
                paymentStatus: "SUCCESS",
                couponId,
                phonePeOrderId: merchantOrderId,
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
                        comment: "Order created after successful PhonePe payment",
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
            },
        });

        // Create payment record
        await prisma.payment.create({
            data: {
                orderId: order.id,
                userId: req.user.id,
                amount: order.total,
                discountAmount: discountAmount > 0 ? discountAmount : null,
                phonePeOrderId: merchantOrderId,
                phonePeTransactionId: statusResult.transactionId || null,
                method: "ONLINE",
                status: "SUCCESS",
                paymentInstrument: statusResult.paymentInstrument || null,
                paymentDetails: statusResult.paymentDetails || undefined,
                couponId,
            },
        });

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

        // Mark pending payment as completed
        await prisma.pendingPayment.update({
            where: { merchantOrderId },
            data: { status: "COMPLETED" },
        });

        return sendSuccess(res, {
            verified: true,
            orderId: order.id,
        }, "Payment verified and order created successfully");
    } catch (error) {
        next(error);
    }
};

// PhonePe S2S webhook callback
export const phonePeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const xVerifyHeader = req.headers["x-verify"] as string;
        const body = JSON.stringify(req.body);

        if (xVerifyHeader) {
            const isValid = verifyPhonePeCallback(xVerifyHeader, body);
            if (!isValid) {
                console.warn("PhonePe webhook: invalid signature");
                return sendError(res, "Invalid signature", 400);
            }
        }

        // PhonePe sends the response in base64 encoded format
        const responseData = req.body.response
            ? JSON.parse(Buffer.from(req.body.response, "base64").toString())
            : req.body;

        const merchantTransactionId = responseData?.data?.merchantTransactionId;
        const code = responseData?.code;

        if (!merchantTransactionId) {
            console.warn("PhonePe webhook: missing merchantTransactionId");
            return sendSuccess(res, { received: true });
        }

        if (code === "PAYMENT_SUCCESS") {
            // Extract payment instrument details from webhook
            const instrument = responseData?.data?.paymentInstrument;
            let paymentInstrument: string | null = null;
            let paymentDetails: Record<string, any> | undefined = undefined;

            if (instrument) {
                paymentInstrument = instrument.type || null;
                if (instrument.type === "UPI") {
                    paymentDetails = { vpa: instrument.utr || instrument.vpa || null };
                } else if (instrument.type === "CARD") {
                    paymentDetails = {
                        cardNetwork: instrument.cardNetwork || null,
                        cardType: instrument.cardType || null,
                        last4: instrument.maskedCardNumber?.slice(-4) || null,
                        issuer: instrument.issuer || null,
                    };
                } else if (instrument.type === "NETBANKING") {
                    paymentDetails = { bankName: instrument.bankId || null };
                } else if (instrument.type === "WALLET") {
                    paymentDetails = { walletType: instrument.walletType || null };
                }
            }

            // Update payment status
            await prisma.payment.updateMany({
                where: { phonePeOrderId: merchantTransactionId },
                data: {
                    status: "SUCCESS",
                    phonePeTransactionId: responseData?.data?.transactionId || null,
                    paymentInstrument,
                    paymentDetails: paymentDetails || undefined,
                },
            });

            await prisma.order.updateMany({
                where: { phonePeOrderId: merchantTransactionId },
                data: { paymentStatus: "SUCCESS" },
            });
        } else if (code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED") {
            await prisma.payment.updateMany({
                where: { phonePeOrderId: merchantTransactionId },
                data: { status: "FAILED" },
            });

            await prisma.order.updateMany({
                where: { phonePeOrderId: merchantTransactionId },
                data: { paymentStatus: "FAILED" },
            });
        }

        return sendSuccess(res, { received: true }, "Webhook processed");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/payments:
 *   get:
 *     summary: Get all payments
 *     description: Admin can view all payment transactions
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payments retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       orderId:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       discountAmount:
 *                         type: number
 *                         nullable: true
 *                       phonePeOrderId:
 *                         type: string
 *                         nullable: true
 *                       phonePeTransactionId:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [PENDING, SUCCESS, FAILED, REFUNDED]
 *                       method:
 *                         type: string
 *                         enum: [ONLINE, OFFLINE]
 *                       couponId:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       order:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           status:
 *                             type: string
 *                           total:
 *                             type: number
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get all payments
export const getAdminPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const status = req.query.status as string | string[];
        const method = req.query.method as string;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;
        const minAmount = req.query.minAmount as string;
        const maxAmount = req.query.maxAmount as string;
        const userId = req.query.userId as string;
        const orderId = req.query.orderId as string;
        const search = req.query.search as string;
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

        // Payment method filter
        if (method) {
            where.method = method;
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

        // Amount range filters
        if (minAmount || maxAmount) {
            where.amount = {};
            if (minAmount) {
                where.amount.gte = parseFloat(minAmount);
            }
            if (maxAmount) {
                where.amount.lte = parseFloat(maxAmount);
            }
        }

        // User filter
        if (userId) {
            where.userId = userId;
        }

        // Order filter
        if (orderId) {
            where.orderId = orderId;
        }

        // Search functionality - search by payment ID, PhonePe IDs, user email/name
        if (search) {
            const searchConditions: any[] = [
                { id: { contains: search } },
                { phonePeOrderId: { contains: search } },
                { phonePeTransactionId: { contains: search } },
                {
                    user: {
                        OR: [
                            { email: { contains: search } },
                            { name: { contains: search } },
                        ],
                    },
                },
            ];

            where.OR = searchConditions;
        }

        // Sorting
        const orderBy: any = {};
        if (sortBy === 'amount') {
            orderBy.amount = sortOrder;
        } else if (sortBy === 'status') {
            orderBy.status = sortOrder;
        } else if (sortBy === 'updatedAt') {
            orderBy.updatedAt = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                    order: {
                        select: {
                            id: true,
                            status: true,
                            total: true,
                            createdAt: true,
                        },
                    },
                    coupon: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.payment.count({ where }),
        ]);

        return sendSuccess(res, {
            payments,
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

/**
 * @openapi
 * /api/v1/admin/payments/{id}:
 *   get:
 *     summary: Get single payment by ID
 *     description: Admin can view detailed payment information
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Payment ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     orderId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     discountAmount:
 *                       type: number
 *                       nullable: true
 *                     phonePeOrderId:
 *                       type: string
 *                       nullable: true
 *                     phonePeTransactionId:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       enum: [PENDING, SUCCESS, FAILED, REFUNDED]
 *                     method:
 *                       type: string
 *                       enum: [ONLINE, OFFLINE]
 *                     couponId:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     order:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                         total:
 *                           type: number
 *                         items:
 *                           type: array
 *                         address:
 *                           type: object
 *                     coupon:
 *                       type: object
 *                       nullable: true
 *       404:
 *         description: Payment not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get single payment
export const getAdminPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("Payment ID is required");
        }

        const payment = await prisma.payment.findUnique({
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
                order: {
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                        address: true,
                    },
                },
                coupon: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new NotFoundError("Payment not found");
        }

        return sendSuccess(res, payment);
    } catch (error) {
        next(error);
    }
};
