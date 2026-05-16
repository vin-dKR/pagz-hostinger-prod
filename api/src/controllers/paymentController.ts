import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { initiatePhonePePayment, checkPhonePePaymentStatus, verifyPhonePeCallback, phonePeConfig } from "../services/phonepe.js";
import { prisma } from "../services/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { verifyFTPFiles, extractFtpPathFromUrl, type FtpVerifyInvalidEntry } from "../services/ftp.js";
import crypto from "crypto";
import {
    collectAddonIds,
    computeAddonsSubtotal,
    fetchAddonRuleMap,
    fetchAddonSpecMap,
    normalizeAddonIds,
} from "../utils/addon-pricing.js";

type RazorpayCreateOrderResponse = {
    id?: string;
    error?: {
        description?: string;
        reason?: string;
    };
};

/**
 * Gather every `customDesignUrl` entry referenced by a list of order
 * items (the request body shape used by `createRazorpayOrderFromCart`
 * and `createPhonePeOrderFromCart`). De-duplicated and normalised to
 * relative FTP paths so a single batch verify covers the whole order.
 */
function collectOrderFtpPaths(items: unknown): string[] {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    for (const item of items) {
        const raw = (item as { customDesignUrl?: unknown } | null)?.customDesignUrl;
        if (!raw) continue;
        const candidates: string[] = Array.isArray(raw)
            ? raw.filter((v): v is string => typeof v === "string")
            : typeof raw === "string"
                ? [raw]
                : [];
        for (const c of candidates) {
            const trimmed = c.trim();
            if (!trimmed) continue;
            const path = extractFtpPathFromUrl(trimmed);
            if (path) seen.add(path);
        }
    }
    return Array.from(seen);
}

/**
 * Belt-and-suspenders gate before creating a payment-gateway order:
 * re-verify every uploaded design file still exists and has size > 0.
 *
 * If any file is missing / empty / unreadable we throw a `ValidationError`
 * with the full per-file breakdown on `details.invalid`, so the client
 * can drop those paths from the cart row and prompt the user to
 * re-upload. The error is logged with the merchant order id so prod
 * incidents stay traceable.
 */
async function assertOrderFilesValid(
    items: unknown,
    merchantOrderId: string,
): Promise<void> {
    const paths = collectOrderFtpPaths(items);
    if (paths.length === 0) return;

    let result: { valid: string[]; invalid: FtpVerifyInvalidEntry[] };
    try {
        result = await verifyFTPFiles(paths);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
            `[Payment ${merchantOrderId}] FTP verify-files failed transiently; allowing payment to proceed: ${message}`,
        );
        // FTP is the source of truth for fulfilment, not for billing. If
        // we can't reach the FTP server at all, the post-upload integrity
        // check that already ran at write time is our last line of
        // defence — failing closed here would block legitimate orders
        // every time Hostinger's FTP burps. We log loudly so ops can
        // notice.
        return;
    }

    if (result.invalid.length === 0) return;

    console.warn(
        `[Payment ${merchantOrderId}] blocked: invalid uploaded files`,
        result.invalid,
    );
    throw new ValidationError(
        "One or more uploaded files are empty or missing. Please re-upload and try again.",
        { invalid: result.invalid },
    );
}

// Create PhonePe order from cart data (redirect-based flow)
export const createPhonePeOrderFromCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { items, addressId, amount, couponCode, shippingCharges, customerComment } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new ValidationError("Order items are required");
        }

        if (!addressId) {
            throw new ValidationError("Shipping address is required");
        }

        if (!amount || Number(amount) <= 0) {
            throw new ValidationError("Valid amount is required");
        }
        if (Number(amount) < 1) {
            throw new ValidationError("Minimum payable amount for Razorpay is ₹1.00");
        }

        // Trim + cap free-form customer comment so adversarial input can't
        // bloat the row or hold control characters.
        const trimmedComment = typeof customerComment === "string"
            ? customerComment.trim().slice(0, 2000)
            : null;

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
                customerComment: trimmedComment,
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

// Create Razorpay order from cart data
export const createRazorpayOrderFromCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { items, addressId, amount, couponCode, shippingCharges, customerComment } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new ValidationError("Order items are required");
        }
        if (!addressId) {
            throw new ValidationError("Shipping address is required");
        }
        if (!amount || Number(amount) <= 0) {
            throw new ValidationError("Valid amount is required");
        }

        const trimmedComment = typeof customerComment === "string"
            ? customerComment.trim().slice(0, 2000)
            : null;

        const razorKeyId = process.env.RAZOR_LIVE_ID;
        const razorKeySecret = process.env.RAZOR_LIVE_SECRET_KEY;
        if (!razorKeyId || !razorKeySecret) {
            return sendError(res, "Razorpay is not configured", 500);
        }

        const address = await prisma.address.findFirst({
            where: {
                id: addressId,
                userId: req.user.id,
            },
        });
        if (!address) {
            throw new NotFoundError("Address not found");
        }

        const merchantOrderId = uuidv4().replace(/-/g, "").slice(0, 32);
        const amountInPaise = Math.round(Number(amount) * 100);

        // CRITICAL: re-verify every uploaded design file before opening
        // Razorpay. Issue #56 — without this guard a user can pay for an
        // order that references 0-byte / missing files and fulfilment
        // fails after the money is captured. Throws ValidationError with
        // per-file `invalid` details so the client strips bad paths and
        // re-prompts. Done BEFORE the PendingPayment row is created so
        // we don't leave orphan rows on rejection.
        await assertOrderFilesValid(items, merchantOrderId);

        await prisma.pendingPayment.create({
            data: {
                merchantOrderId,
                userId: req.user.id,
                addressId,
                items: JSON.parse(JSON.stringify(items)),
                amount: Number(amount),
                couponCode: couponCode || null,
                shippingCharges: shippingCharges ? Number(shippingCharges) : null,
                customerComment: trimmedComment,
                status: "PENDING",
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });

        const auth = Buffer.from(`${razorKeyId}:${razorKeySecret}`).toString("base64");
        const razorResponse = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
                amount: amountInPaise,
                currency: "INR",
                receipt: merchantOrderId,
                payment_capture: 1,
                notes: {
                    merchantOrderId,
                    userId: req.user.id,
                },
            }),
        });

        const razorData = (await razorResponse.json()) as RazorpayCreateOrderResponse;
        if (!razorResponse.ok || !razorData?.id) {
            await prisma.pendingPayment.delete({ where: { merchantOrderId } }).catch(() => undefined);
            return sendError(
                res,
                razorData?.error?.description || razorData?.error?.reason || "Failed to create Razorpay order",
                400
            );
        }

        return sendSuccess(res, {
            keyId: razorKeyId,
            merchantOrderId,
            razorpayOrderId: razorData.id,
            amount: amountInPaise,
            currency: "INR",
        }, "Razorpay order created successfully");
    } catch (error) {
        next(error);
    }
};

// Verify Razorpay payment and create order
export const verifyRazorpayPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { merchantOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        if (!merchantOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            throw new ValidationError("merchantOrderId, razorpayOrderId, razorpayPaymentId and razorpaySignature are required");
        }

        const razorKeySecret = process.env.RAZOR_LIVE_SECRET_KEY;
        if (!razorKeySecret) {
            return sendError(res, "Razorpay is not configured", 500);
        }

        const expectedSignature = crypto
            .createHmac("sha256", razorKeySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        if (expectedSignature !== razorpaySignature) {
            return sendSuccess(res, {
                verified: false,
                message: "Invalid Razorpay signature",
            }, "Payment verification failed");
        }

        const existingOrder = await prisma.order.findFirst({
            where: {
                phonePeOrderId: merchantOrderId,
                userId: req.user.id,
            },
        });
        if (existingOrder) {
            return sendSuccess(res, { verified: true, orderId: existingOrder.id }, "Payment already verified");
        }

        const pendingPayment = await prisma.pendingPayment.findUnique({
            where: { merchantOrderId },
        });
        if (!pendingPayment) {
            throw new NotFoundError("Pending payment not found");
        }
        if (pendingPayment.userId !== req.user.id) {
            throw new UnauthorizedError("Payment does not belong to this user");
        }

        const items = pendingPayment.items as any[];
        const addressId = pendingPayment.addressId;
        const couponCode = pendingPayment.couponCode;
        const shippingCharges = Number(pendingPayment.shippingCharges || 0);
        const pendingCustomerComment = (pendingPayment as { customerComment?: string | null }).customerComment ?? null;

        const address = await prisma.address.findFirst({
            where: { id: addressId, userId: req.user.id },
        });
        if (!address) {
            throw new NotFoundError("Address not found");
        }

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
            fileCount: number;
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
            // metadata.priceBreakdown (written by the service page) contains
            // BOTH the base and the addon lines. Deriving item price from its
            // sum would silently double-count addons because we add the
            // server-computed `addonsSubtotal` to the total below. Only use
            // the breakdown to recover the base-price portion.
            if (metadata && Array.isArray(metadata.priceBreakdown)) {
                const basePortion = metadata.priceBreakdown.reduce(
                    (sum: number, entry: any) => {
                        const label = typeof entry?.label === "string"
                            ? entry.label.toLowerCase()
                            : "";
                        if (label.startsWith("addon")) return sum;
                        return sum + Number(entry?.value || 0);
                    },
                    0
                );
                if (quantity > 0 && basePortion > 0) {
                    itemPrice = basePortion / quantity;
                }
            }

            subtotal += itemPrice * quantity;

            let normalizedUrls: string[] = [];
            if (customDesignUrl) {
                if (Array.isArray(customDesignUrl)) {
                    normalizedUrls = customDesignUrl.filter((url): url is string => typeof url === "string" && url.length > 0);
                } else if (typeof customDesignUrl === "string" && customDesignUrl.length > 0) {
                    normalizedUrls = [customDesignUrl];
                }
            }

            // Prefer the explicit top-level addons array; fall back to
            // metadata.selectedAddons for intent saved by "pending cart" flows
            // that predate the top-level field.
            const rawAddons = Array.isArray(item.addons)
                ? item.addons
                : Array.isArray(metadata?.selectedAddons)
                    ? metadata.selectedAddons
                    : [];
            const selectedAddons = normalizeAddonIds(rawAddons);

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
                fileCount: normalizedUrls.length,
            });
        }

        // Compute addonsSubtotal before discount so % coupons apply against
        // the true line total (base × qty × fileMultiplier + addons), not the
        // base subtotal alone.
        const addonIdsRzp = collectAddonIds(orderItems);
        const [addonMapRzp, addonSpecMapRzp] = await Promise.all([
            fetchAddonRuleMap(addonIdsRzp),
            fetchAddonSpecMap(addonIdsRzp),
        ]);
        const addonsSubtotal = computeAddonsSubtotal(orderItems, addonMapRzp, addonSpecMapRzp);
        const grossSubtotal = subtotal + addonsSubtotal;

        let discountAmount = 0;
        let couponId = null;
        if (couponCode && couponCode.trim()) {
            const coupon = await prisma.coupon.findUnique({
                where: { code: String(couponCode).toUpperCase() },
            });
            if (coupon && coupon.isActive) {
                const now = new Date();
                if (now >= coupon.validFrom && now <= coupon.validUntil) {
                    if (!coupon.minPurchaseAmount || grossSubtotal >= Number(coupon.minPurchaseAmount)) {
                        const usageCount = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
                        if (coupon.usageLimit === null || usageCount < coupon.usageLimit) {
                            const userUsageCount = await prisma.couponUsage.count({
                                where: { couponId: coupon.id, userId: req.user.id },
                            });
                            if (userUsageCount < coupon.usageLimitPerUser) {
                                discountAmount = coupon.discountType === "PERCENTAGE"
                                    ? (grossSubtotal * Number(coupon.discountValue)) / 100
                                    : Number(coupon.discountValue);
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

        // Clamp at 0 so an oversized discount can never persist a negative total.
        const total = Math.max(0, grossSubtotal - discountAmount + shippingCharges);
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
                refundStatus: "PENDING",
                refundEligibleAmount: total,
                customerComment: pendingCustomerComment,
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
                        addons: oi.addons && oi.addons.length > 0
                            ? { connect: oi.addons.map((id: string) => ({ id })) }
                            : undefined,
                    })),
                },
                statusHistory: {
                    create: {
                        status: "PENDING_REVIEW",
                        comment: "Order created after successful Razorpay payment",
                    },
                },
            },
        });

        await prisma.payment.create({
            data: {
                orderId: order.id,
                userId: req.user.id,
                amount: order.total,
                discountAmount: discountAmount > 0 ? discountAmount : null,
                phonePeOrderId: merchantOrderId,
                phonePeTransactionId: razorpayPaymentId,
                method: "ONLINE",
                status: "SUCCESS",
                gateway: "RAZORPAY",
                gatewayOrderId: razorpayOrderId,
                gatewayPaymentId: razorpayPaymentId,
                refundedAmount: 0,
                paymentInstrument: "RAZORPAY",
                paymentDetails: {
                    gateway: "RAZORPAY",
                    razorpayOrderId,
                    razorpayPaymentId,
                },
                couponId,
            },
        });

        if (couponId) {
            await prisma.couponUsage.create({
                data: {
                    couponId,
                    userId: req.user.id,
                    orderId: order.id,
                },
            });
        }

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
        const pendingCustomerComment = (pendingPayment as { customerComment?: string | null }).customerComment ?? null;
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
            fileCount: number;
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

            // metadata.priceBreakdown (written by the service page) contains
            // BOTH the base and the addon lines. Deriving item price from its
            // sum would silently double-count addons because we add the
            // server-computed `addonsSubtotal` to the total below. Only use
            // the breakdown to recover the base-price portion.
            if (metadata && Array.isArray(metadata.priceBreakdown)) {
                const basePortion = metadata.priceBreakdown.reduce(
                    (sum: number, entry: any) => {
                        const label = typeof entry?.label === "string"
                            ? entry.label.toLowerCase()
                            : "";
                        if (label.startsWith("addon")) return sum;
                        return sum + Number(entry?.value || 0);
                    },
                    0
                );
                if (quantity > 0 && basePortion > 0) {
                    itemPrice = basePortion / quantity;
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
            const rawAddons = Array.isArray(item.addons)
                ? item.addons
                : Array.isArray(metadata?.selectedAddons)
                    ? metadata.selectedAddons
                    : [];
            const selectedAddons = normalizeAddonIds(rawAddons);

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
                fileCount: normalizedUrls.length,
            });
        }

        // Compute addons subtotal using the shared helper so cart, order
        // creation, and invoice printing all produce the same number. Must
        // happen BEFORE discount calculation so % coupons apply to the full
        // line total, not just the base subtotal.
        const addonIdsPpe = collectAddonIds(orderItems);
        const [addonMapPpe, addonSpecMapPpe] = await Promise.all([
            fetchAddonRuleMap(addonIdsPpe),
            fetchAddonSpecMap(addonIdsPpe),
        ]);
        const addonsSubtotal = computeAddonsSubtotal(orderItems, addonMapPpe, addonSpecMapPpe);
        const grossSubtotal = subtotal + addonsSubtotal;

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
                    if (!coupon.minPurchaseAmount || grossSubtotal >= Number(coupon.minPurchaseAmount)) {
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
                                    discountAmount = (grossSubtotal * Number(coupon.discountValue)) / 100;
                                } else {
                                    discountAmount = Number(coupon.discountValue);
                                }

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

        // Calculate final total (subtotal + addonsSubtotal - discount + shipping)
        // Clamp at 0 so an oversized discount can never persist a negative total.
        const total = Math.max(0, grossSubtotal - discountAmount + shippingCharges);

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
                refundStatus: "PENDING",
                refundEligibleAmount: total,
                customerComment: pendingCustomerComment,
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
                        ...(oi.addons && oi.addons.length > 0 && {
                            addons: { connect: oi.addons.map((id: string) => ({ id })) },
                        }),
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
                gateway: "PHONEPE",
                gatewayOrderId: merchantOrderId,
                gatewayPaymentId: statusResult.transactionId || merchantOrderId,
                refundedAmount: 0,
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
 * /api/v1/admin/payments/statistics:
 *   get:
 *     summary: Get payment statistics
 *     description: Admin can view payment statistics including total revenue, payments by status, and period-based metrics
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: dateFrom
 *         in: query
 *         required: false
 *         description: Start date for filtering (ISO 8601 format)
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: dateTo
 *         in: query
 *         required: false
 *         description: End date for filtering (ISO 8601 format)
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Payment statistics retrieved successfully
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
 *                     totalPayments:
 *                       type: integer
 *                     payments:
 *                       type: object
 *                       properties:
 *                         today:
 *                           type: integer
 *                         week:
 *                           type: integer
 *                         month:
 *                           type: integer
 *                     totalRevenue:
 *                       type: number
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         today:
 *                           type: number
 *                         week:
 *                           type: number
 *                         month:
 *                           type: number
 *                     paymentsByStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     paymentsByMethod:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           method:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     pendingPaymentsCount:
 *                       type: integer
 *                     averagePaymentValue:
 *                       type: number
 *                     successfulPaymentsCount:
 *                       type: integer
 *                     failedPaymentsCount:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get payment statistics
export const getPaymentStatistics = async (req: Request, res: Response, next: NextFunction) => {
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

        // Total payments
        const totalPayments = await prisma.payment.count({ where });

        // Get amounts for each status
        const [pendingData, successfulData, failedData, refundedData] = await Promise.all([
            Promise.all([
                prisma.payment.count({ where: { ...where, status: "PENDING" } }),
                prisma.payment.aggregate({
                    where: { ...where, status: "PENDING" },
                    _sum: { amount: true },
                }),
            ]),
            Promise.all([
                prisma.payment.count({ where: { ...where, status: "SUCCESS" } }),
                prisma.payment.aggregate({
                    where: { ...where, status: "SUCCESS" },
                    _sum: { amount: true },
                }),
            ]),
            Promise.all([
                prisma.payment.count({ where: { ...where, status: "FAILED" } }),
                prisma.payment.aggregate({
                    where: { ...where, status: "FAILED" },
                    _sum: { amount: true },
                }),
            ]),
            Promise.all([
                prisma.payment.count({ where: { ...where, status: "REFUNDED" } }),
                prisma.payment.aggregate({
                    where: { ...where, status: "REFUNDED" },
                    _sum: { amount: true },
                }),
            ]),
        ]);

        const pendingPayments = pendingData[0];
        const pendingAmount = Number(pendingData[1]._sum.amount || 0);
        const successfulPayments = successfulData[0];
        const successfulAmount = Number(successfulData[1]._sum.amount || 0);
        const failedPayments = failedData[0];
        const failedAmount = Number(failedData[1]._sum.amount || 0);
        const refundedPayments = refundedData[0];
        const refundedAmount = Number(refundedData[1]._sum.amount || 0);

        // Total amount (all payments, not just successful)
        const totalAmountResult = await prisma.payment.aggregate({
            where,
            _sum: { amount: true },
        });
        const totalAmount = Number(totalAmountResult._sum.amount || 0);

        // Average transaction value (from successful payments)
        const avgTransactionValue = await prisma.payment.aggregate({
            where: { ...where, status: "SUCCESS" },
            _avg: { amount: true },
        });

        // Payments by status (with amounts)
        const paymentsByStatusData = await prisma.payment.groupBy({
            by: ["status"],
            where,
            _count: { status: true },
            _sum: { amount: true },
        });

        // Payments by method (with amounts)
        const paymentsByMethodData = await prisma.payment.groupBy({
            by: ["method"],
            where,
            _count: { method: true },
            _sum: { amount: true },
        });

        // Convert to objects as expected by frontend
        const byStatus: Record<string, { count: number; amount: number }> = {};
        paymentsByStatusData.forEach((item) => {
            if (item.status) {
                byStatus[item.status] = {
                    count: item._count.status,
                    amount: Number(item._sum.amount || 0),
                };
            }
        });

        const byMethod: Record<string, { count: number; amount: number }> = {};
        paymentsByMethodData.forEach((item) => {
            if (item.method) {
                byMethod[item.method] = {
                    count: item._count.method,
                    amount: Number(item._sum.amount || 0),
                };
            }
        });

        // Recent payments (last 10)
        const recentPayments = await prisma.payment.findMany({
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
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        // Daily stats for last 30 days
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const dailyPayments = await prisma.payment.findMany({
            where: {
                ...where,
                createdAt: { gte: thirtyDaysAgo },
            },
            select: {
                amount: true,
                createdAt: true,
            },
        });

        // Group by date
        const dailyStatsMap = new Map<string, { count: number; amount: number }>();
        dailyPayments.forEach((payment) => {
            const dateStr = new Date(payment.createdAt).toISOString().split("T")[0];
            if (dateStr) {
                const existing = dailyStatsMap.get(dateStr) || { count: 0, amount: 0 };
                dailyStatsMap.set(dateStr, {
                    count: existing.count + 1,
                    amount: existing.amount + Number(payment.amount),
                });
            }
        });

        const dailyStats = Array.from(dailyStatsMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return sendSuccess(res, {
            totalPayments,
            totalAmount,
            successfulPayments,
            successfulAmount,
            pendingPayments,
            pendingAmount,
            failedPayments,
            failedAmount,
            refundedPayments,
            refundedAmount,
            averageTransactionValue: Number(avgTransactionValue._avg.amount || 0),
            byStatus,
            byMethod,
            recentPayments,
            dailyStats,
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
