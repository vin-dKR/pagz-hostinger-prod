import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { razorpay } from "../services/razorpay.js";
import { prisma } from "../services/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";

// Create Razorpay order from cart data (order created only after payment success)
export const createRazorpayOrderFromCart = async (req: Request, res: Response, next: NextFunction) => {
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

        if (!razorpay) {
            return sendError(res, "Razorpay not configured", 500);
        }

        // Create Razorpay order with cart data stored in notes
        const amountInPaise = Math.round(Number(amount) * 100);
        const receipt = `cart_${Date.now()}`.slice(0, 40); // Ensure receipt is <= 40 chars

        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt,
            notes: {
                userId: req.user.id,
                addressId,
                items: JSON.stringify(items),
                couponCode: couponCode || "",
                shippingCharges: String(shippingCharges || 0),
                amount: String(amount),
            },
        });

        const orderAmount = typeof razorpayOrder.amount === "number"
            ? razorpayOrder.amount / 100
            : Number(razorpayOrder.amount) / 100;

        return sendSuccess(res, {
            razorpayOrderId: razorpayOrder.id,
            amount: orderAmount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
        }, "Razorpay order created successfully");
    } catch (error) {
        next(error);
    }
};

// Create Razorpay order (legacy - for existing orders)
export const createRazorpayOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { orderId, amount } = req.body;

        if (!orderId || !amount) {
            throw new ValidationError("Order ID and amount are required");
        }

        // Verify order belongs to user
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId: req.user.id,
                paymentMethod: "ONLINE",
                paymentStatus: "PENDING",
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found or already paid");
        }

        if (Number(order.total) !== Number(amount)) {
            throw new ValidationError("Amount mismatch");
        }

        if (!razorpay) {
            return sendError(res, "Razorpay not configured", 500);
        }

        // Create Razorpay order
        const amountInPaise = Math.round(Number(amount) * 100); // Convert to paise
        // Razorpay receipt has a max length of 40 chars – keep it short and deterministic
        const shortOrderId = String(order.id).slice(0, 30);
        const receipt = `ord_${shortOrderId}`;
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt,
            notes: {
                orderId: order.id,
                userId: req.user.id,
            },
        });

        // Update order with Razorpay order ID
        await prisma.order.update({
            where: { id: orderId },
            data: { razorpayOrderId: razorpayOrder.id },
        });

        // Create payment record
        await prisma.payment.create({
            data: {
                orderId: order.id,
                userId: req.user.id,
                amount: order.total,
                razorpayOrderId: razorpayOrder.id,
                method: "ONLINE",
                status: "PENDING",
            },
        });

        const orderAmount = typeof razorpayOrder.amount === "number"
            ? razorpayOrder.amount / 100
            : Number(razorpayOrder.amount) / 100;

        return sendSuccess(res, {
            razorpayOrderId: razorpayOrder.id,
            amount: orderAmount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
        }, "Razorpay order created successfully");
    } catch (error) {
        next(error);
    }
};

// Verify Razorpay payment and create order if it doesn't exist
export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new ValidationError("Missing payment verification data");
        }

        // Verify signature FIRST before any DB operations
        const secret = process.env.RAZORPAY_KEY_SECRET || "";
        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generatedSignature = crypto
            .createHmac("sha256", secret)
            .update(text)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return sendError(res, "Payment verification failed", 400);
        }

        // Check if order already exists
        let order = await prisma.order.findFirst({
            where: {
                razorpayOrderId: razorpay_order_id,
                userId: req.user.id,
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

        // If order doesn't exist, create it from Razorpay order notes
        if (!order && razorpay) {
            try {
                // Fetch Razorpay order to get cart data from notes
                const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
                const notes = razorpayOrder.notes || {};

                // Validate notes contain required data
                if (!notes.userId || String(notes.userId) !== req.user.id) {
                    throw new ValidationError("Invalid order data");
                }

                const items = JSON.parse(String(notes.items || "[]"));
                const addressId = String(notes.addressId || "");
                const couponCode = String(notes.couponCode || "");
                const shippingCharges = Number(notes.shippingCharges || 0);

                if (!items || !Array.isArray(items) || items.length === 0 || !addressId) {
                    throw new ValidationError("Invalid order data in Razorpay notes");
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

                // Calculate order totals (same logic as createOrder)
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
                    const { productId, variantId, quantity, customDesignUrl, customText, metadata } = item;

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

                    // Normalize customDesignUrl to array (files already uploaded to S3 when added to cart)
                    let normalizedUrls: string[] = [];
                    if (customDesignUrl) {
                        if (Array.isArray(customDesignUrl)) {
                            normalizedUrls = customDesignUrl.filter((url): url is string => typeof url === 'string' && url.length > 0);
                        } else if (typeof customDesignUrl === 'string' && customDesignUrl.length > 0) {
                            normalizedUrls = [customDesignUrl];
                        }
                    }

                    // Extract addon metadata if present
                    const selectedAddons: string[] = Array.isArray(metadata?.selectedAddons)
                        ? (metadata.selectedAddons as string[])
                        : [];

                    // Create order item with S3 URLs from cart (files already uploaded)
                    orderItems.push({
                        productId,
                        variantId: variantId || null,
                        quantity,
                        price: itemPrice,
                        customDesignUrl: normalizedUrls, // Use S3 URLs from cart items
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

                // Calculate final total
                const total = subtotal - discountAmount + shippingCharges;

                // Create order with S3 URLs from cart items (files already uploaded to S3 when user selected them)
                order = await prisma.order.create({
                    data: {
                        userId: req.user.id,
                        addressId,
                        subtotal,
                        discountAmount: discountAmount > 0 ? discountAmount : null,
                        shippingCharges: shippingCharges > 0 ? shippingCharges : null,
                        total,
                        paymentMethod: "ONLINE",
                        paymentStatus: "SUCCESS", // Payment already verified
                        couponId,
                        razorpayOrderId: razorpay_order_id,
                        status: "PENDING_REVIEW",
                        items: {
                            create: orderItems.map((oi) => ({
                                productId: oi.productId,
                                variantId: oi.variantId,
                                quantity: oi.quantity,
                                price: oi.price,
                                customDesignUrl: oi.customDesignUrl,
                                customText: oi.customText,
                                metadata: oi.metadata ?? undefined,
                            })),
                        },
                        statusHistory: {
                            create: {
                                status: "PENDING_REVIEW",
                                comment: "Order created after successful payment",
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
            } catch (createError) {
                console.error("Error creating order from Razorpay notes:", createError);
                throw new ValidationError("Failed to create order from payment data");
            }
        }

        if (!order) {
            throw new NotFoundError("Order not found and could not be created");
        }

        // Find or create payment record
        let payment = await prisma.payment.findFirst({
            where: {
                razorpayOrderId: razorpay_order_id,
                userId: req.user.id,
            },
        });

        if (!payment) {
            // Create payment record
            payment = await prisma.payment.create({
                data: {
                    orderId: order.id,
                    userId: req.user.id,
                    amount: order.total,
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    method: "ONLINE",
                    status: "SUCCESS",
                },
            });
        } else {
            // Update existing payment
            payment = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    razorpayPaymentId: razorpay_payment_id,
                    status: "SUCCESS",
                },
            });
        }

        // Update order payment status if not already set
        if (order.paymentStatus !== "SUCCESS") {
            await prisma.order.update({
                where: { id: order.id },
                data: { paymentStatus: "SUCCESS" },
            });
        }

        return sendSuccess(res, {
            verified: true,
            orderId: order.id,
            paymentId: payment.id,
        }, "Payment verified successfully");
    } catch (error) {
        next(error);
    }
};

// Razorpay webhook
export const razorpayWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
        const signature = req.headers["x-razorpay-signature"] as string;

        if (!signature) {
            return sendError(res, "Missing signature", 400);
        }

        const body = JSON.stringify(req.body);
        const generatedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        if (generatedSignature !== signature) {
            return sendError(res, "Invalid signature", 400);
        }

        const event = req.body.event;
        const payload = req.body.payload;

        // Handle different webhook events
        switch (event) {
            case "payment.captured":
                await handlePaymentCaptured(payload);
                break;
            case "payment.failed":
                await handlePaymentFailed(payload);
                break;
            case "order.paid":
                await handleOrderPaid(payload);
                break;
            default:
                console.log(`Unhandled webhook event: ${event}`);
        }

        return sendSuccess(res, { received: true }, "Webhook processed");
    } catch (error) {
        next(error);
    }
};

// Helper functions for webhook handlers
async function handlePaymentCaptured(payload: any) {
    const paymentEntity = payload?.payment?.entity;

    if (!paymentEntity) {
        console.warn("Razorpay webhook: missing payment entity in payload for payment.captured");
        return;
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;

    if (!razorpayPaymentId) {
        console.warn("Razorpay webhook: missing payment id in payment.captured payload");
        return;
    }

    await prisma.payment.updateMany({
        where: { razorpayPaymentId },
        data: {
            status: "SUCCESS",
            razorpayPaymentId,
        },
    });

    if (razorpayOrderId) {
        await prisma.order.updateMany({
            where: { razorpayOrderId },
            data: { paymentStatus: "SUCCESS" },
        });
    }
}

async function handlePaymentFailed(payload: any) {
    const paymentEntity = payload?.payment?.entity;

    if (!paymentEntity) {
        console.warn("Razorpay webhook: missing payment entity in payload for payment.failed");
        return;
    }

    const razorpayPaymentId = paymentEntity.id;

    if (!razorpayPaymentId) {
        console.warn("Razorpay webhook: missing payment id in payment.failed payload");
        return;
    }

    await prisma.payment.updateMany({
        where: { razorpayPaymentId },
        data: { status: "FAILED" },
    });
}

async function handleOrderPaid(payload: any) {
    const orderEntity = payload?.order?.entity;

    if (!orderEntity) {
        console.warn("Razorpay webhook: missing order entity in payload for order.paid");
        return;
    }

    const razorpayOrderId = orderEntity.id;

    if (!razorpayOrderId) {
        console.warn("Razorpay webhook: missing order id in order.paid payload");
        return;
    }

    await prisma.order.updateMany({
        where: { razorpayOrderId },
        data: { paymentStatus: "SUCCESS" },
    });
}

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
 *                       razorpayOrderId:
 *                         type: string
 *                         nullable: true
 *                       razorpayPaymentId:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [PENDING, SUCCESS, FAILED, REFUNDED]
 *                       method:
 *                         type: string
 *                         enum: [ONLINE, COD, WALLET]
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
        const payments = await prisma.payment.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                order: {
                    select: {
                        id: true,
                        status: true,
                        total: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return sendSuccess(res, payments);
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
 *                     razorpayOrderId:
 *                       type: string
 *                       nullable: true
 *                     razorpayPaymentId:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       enum: [PENDING, SUCCESS, FAILED, REFUNDED]
 *                     method:
 *                       type: string
 *                       enum: [ONLINE, COD, WALLET]
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
            where: { id },
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

