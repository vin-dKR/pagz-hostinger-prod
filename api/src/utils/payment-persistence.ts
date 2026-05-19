/**
 * Shared payment-persistence helpers used by both the customer-initiated
 * `/payment/razorpay/verify` flow and the gateway-driven `/webhooks/razorpay`
 * flow.
 *
 * Both code paths must produce identical Order + OrderItems + Payment +
 * CouponUsage rows from a single `PendingPayment`. Keeping the logic here
 * avoids drift between them — drift is the root cause of the "payment
 * succeeded but no Order row" class of failures (#55).
 */
import crypto from "crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../services/prisma.js";
import { ValidationError, NotFoundError } from "./errors.js";
import {
    collectAddonIds,
    computeAddonsSubtotal,
    fetchAddonRuleMap,
    fetchAddonSpecMap,
    normalizeAddonIds,
    type AddonLineItemInput,
} from "./addon-pricing.js";

// Prisma transaction client — every interactive transaction callback gets one
// of these. Aliased so call sites don't have to spell the generic.
type Tx = Prisma.TransactionClient;

/**
 * One normalized order line as derived from a `PendingPayment.items` entry.
 * Built once by `buildOrderItemsFromPending` and consumed by the persistence
 * step.
 */
export interface NormalizedOrderItem {
    productId: string;
    variantId: string | null;
    quantity: number;
    price: number;
    customDesignUrl: string[];
    customText: string | null;
    hasAddon: boolean;
    addons: string[];
    /** Raw item metadata as captured at create-order time. Must be
     *  AddonLineItemInput-compatible so addon-pricing helpers can reuse it. */
    metadata?: AddonLineItemInput["metadata"];
    fileCount: number;
}

/**
 * Gateway-side info from a successful verify call or `payment.captured` /
 * `order.paid` webhook. Both paths land in `persistOrderFromPending` so the
 * Payment row holds the same shape regardless of who triggered it.
 */
export interface GatewayPaymentInfo {
    /** Razorpay `order_xxx` — the gateway-issued order id. */
    razorpayOrderId: string;
    /** Razorpay `pay_xxx` — the gateway-issued payment id. */
    razorpayPaymentId: string;
    /** Optional UPI/CARD/NETBANKING/WALLET label, when surfaced by webhook. */
    paymentInstrument?: string | null;
    /** Optional gateway-supplied payment details (vpa, card last4, etc). */
    paymentDetails?: Record<string, unknown> | null;
}

/**
 * Build + price-resolve `PendingPayment.items` into normalized order lines.
 *
 * Mirrors the pricing logic that used to live inline in
 * `verifyRazorpayPayment` / `verifyPhonePePayment`. Pulled out so verify and
 * webhook get pixel-identical price math.
 */
export async function buildOrderItemsFromPending(
    tx: Tx | typeof prisma,
    items: unknown[],
): Promise<{ orderItems: NormalizedOrderItem[]; subtotal: number }> {
    let subtotal = 0;
    const orderItems: NormalizedOrderItem[] = [];

    for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const productId = item.productId as string | undefined;
        const variantId = item.variantId as string | null | undefined;
        const quantity = item.quantity as number | undefined;
        const customDesignUrl = item.customDesignUrl as unknown;
        const customText = item.customText as string | null | undefined;
        const metadata = item.metadata as
            | (AddonLineItemInput["metadata"] & { priceBreakdown?: Array<{ label?: string; value?: number }>; selectedAddons?: unknown })
            | null
            | undefined;
        if (!productId || !quantity || Number(quantity) < 1) {
            throw new ValidationError("Invalid order item");
        }

        const product = await tx.product.findUnique({
            where: { id: productId },
            include: { variants: true },
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

        // metadata.priceBreakdown carries BOTH base and addon lines. We
        // intentionally exclude addon lines from the per-item price because
        // `addonsSubtotal` is added to the total separately below — including
        // them here would silently double-count.
        if (metadata && Array.isArray(metadata.priceBreakdown)) {
            const basePortion = metadata.priceBreakdown.reduce(
                (sum: number, entry: { label?: string; value?: number }) => {
                    const label = typeof entry?.label === "string"
                        ? entry.label.toLowerCase()
                        : "";
                    if (label.startsWith("addon")) return sum;
                    return sum + Number(entry?.value || 0);
                },
                0,
            );
            if (Number(quantity) > 0 && basePortion > 0) {
                itemPrice = basePortion / Number(quantity);
            }
        }

        subtotal += itemPrice * Number(quantity);

        let normalizedUrls: string[] = [];
        if (customDesignUrl) {
            if (Array.isArray(customDesignUrl)) {
                normalizedUrls = customDesignUrl.filter(
                    (url): url is string => typeof url === "string" && url.length > 0,
                );
            } else if (typeof customDesignUrl === "string" && customDesignUrl.length > 0) {
                normalizedUrls = [customDesignUrl];
            }
        }

        const rawAddons = Array.isArray(item.addons)
            ? item.addons
            : Array.isArray(metadata?.selectedAddons)
                ? metadata.selectedAddons
                : [];
        const selectedAddons = normalizeAddonIds(rawAddons);

        orderItems.push({
            productId: productId as string,
            variantId: variantId || null,
            quantity: Number(quantity),
            price: itemPrice,
            customDesignUrl: normalizedUrls,
            customText: customText || null,
            hasAddon: selectedAddons.length > 0,
            addons: selectedAddons,
            metadata: metadata || undefined,
            fileCount: normalizedUrls.length,
        });
    }

    return { orderItems, subtotal };
}

/**
 * Resolve coupon eligibility for a given gross subtotal + user, returning
 * `{ discountAmount, couponId }`. Returns `discountAmount = 0` if the coupon
 * is missing, expired, inactive, or otherwise unusable — never throws.
 */
export async function resolveCouponDiscount(
    tx: Tx | typeof prisma,
    couponCode: string | null | undefined,
    grossSubtotal: number,
    userId: string,
): Promise<{ discountAmount: number; couponId: string | null }> {
    if (!couponCode || !couponCode.trim()) {
        return { discountAmount: 0, couponId: null };
    }

    const coupon = await tx.coupon.findUnique({
        where: { code: String(couponCode).toUpperCase() },
    });
    if (!coupon || !coupon.isActive) return { discountAmount: 0, couponId: null };

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
        return { discountAmount: 0, couponId: null };
    }
    if (coupon.minPurchaseAmount && grossSubtotal < Number(coupon.minPurchaseAmount)) {
        return { discountAmount: 0, couponId: null };
    }

    const [usageCount, userUsageCount] = await Promise.all([
        tx.couponUsage.count({ where: { couponId: coupon.id } }),
        tx.couponUsage.count({ where: { couponId: coupon.id, userId } }),
    ]);
    if (coupon.usageLimit !== null && usageCount >= coupon.usageLimit) {
        return { discountAmount: 0, couponId: null };
    }
    if (userUsageCount >= coupon.usageLimitPerUser) {
        return { discountAmount: 0, couponId: null };
    }

    let discountAmount = coupon.discountType === "PERCENTAGE"
        ? (grossSubtotal * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
        discountAmount = Number(coupon.maxDiscountAmount);
    }
    if (discountAmount > grossSubtotal) discountAmount = grossSubtotal;

    return { discountAmount, couponId: coupon.id };
}

/**
 * The actual persistence step: Order + OrderItems + Payment (+ optional
 * CouponUsage) created inside a single Prisma transaction. PendingPayment is
 * marked COMPLETED in the same tx so any failure rolls everything back —
 * eliminates the "Order created, Payment missing" half-write scenario.
 *
 * Caller is expected to handle the P2002 race separately via
 * `persistOrderWithRaceGuard`.
 */
export async function persistOrderFromPending(
    tx: Tx,
    pendingPayment: {
        merchantOrderId: string;
        userId: string;
        addressId: string;
        items: unknown;
        couponCode: string | null;
        shippingCharges: unknown;
        customerComment: string | null;
    },
    gateway: GatewayPaymentInfo,
    statusComment: string,
): Promise<{ orderId: string }> {
    const items = pendingPayment.items as unknown[];
    const shippingCharges = Number(pendingPayment.shippingCharges || 0);

    // Address verification — guards against the corner case where a user
    // deletes their address between cart-create and webhook-arrive.
    const address = await tx.address.findFirst({
        where: { id: pendingPayment.addressId, userId: pendingPayment.userId },
    });
    if (!address) {
        throw new NotFoundError("Address not found");
    }

    const { orderItems, subtotal } = await buildOrderItemsFromPending(tx, items);

    const addonIds = collectAddonIds(orderItems);
    const [addonMap, addonSpecMap] = await Promise.all([
        fetchAddonRuleMap(addonIds),
        fetchAddonSpecMap(addonIds),
    ]);
    const addonsSubtotal = computeAddonsSubtotal(orderItems, addonMap, addonSpecMap);
    const grossSubtotal = subtotal + addonsSubtotal;

    const { discountAmount, couponId } = await resolveCouponDiscount(
        tx,
        pendingPayment.couponCode,
        grossSubtotal,
        pendingPayment.userId,
    );

    // Clamp at 0 — discounts must never produce a negative total.
    const total = Math.max(0, grossSubtotal - discountAmount + shippingCharges);

    const order = await tx.order.create({
        data: {
            userId: pendingPayment.userId,
            addressId: pendingPayment.addressId,
            subtotal,
            addonsSubtotal: addonsSubtotal > 0 ? addonsSubtotal : null,
            discountAmount: discountAmount > 0 ? discountAmount : null,
            shippingCharges: shippingCharges > 0 ? shippingCharges : null,
            total,
            paymentMethod: "ONLINE",
            paymentStatus: "SUCCESS",
            refundStatus: "PENDING",
            refundEligibleAmount: total,
            customerComment: pendingPayment.customerComment,
            couponId,
            gatewayOrderId: pendingPayment.merchantOrderId,
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
                    metadata: (oi.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
                    addons: oi.addons.length > 0
                        ? { connect: oi.addons.map((id: string) => ({ id })) }
                        : undefined,
                })),
            },
            statusHistory: {
                create: {
                    status: "PENDING_REVIEW",
                    comment: statusComment,
                },
            },
        },
    });

    await tx.payment.create({
        data: {
            orderId: order.id,
            userId: pendingPayment.userId,
            amount: order.total,
            discountAmount: discountAmount > 0 ? discountAmount : null,
            gatewayOrderId: pendingPayment.merchantOrderId,
            gatewayTransactionId: gateway.razorpayPaymentId,
            method: "ONLINE",
            status: "SUCCESS",
            gateway: "RAZORPAY",
            gatewayPaymentId: gateway.razorpayPaymentId,
            gatewayProviderOrderId: gateway.razorpayOrderId,
            refundedAmount: 0,
            paymentInstrument: gateway.paymentInstrument ?? "RAZORPAY",
            paymentDetails: ((gateway.paymentDetails as Prisma.InputJsonValue | undefined) ?? {
                gateway: "RAZORPAY",
                razorpayOrderId: gateway.razorpayOrderId,
                razorpayPaymentId: gateway.razorpayPaymentId,
            }) as Prisma.InputJsonValue,
            couponId,
        },
    });

    if (couponId) {
        await tx.couponUsage.create({
            data: {
                couponId,
                userId: pendingPayment.userId,
                orderId: order.id,
            },
        });
    }

    await tx.pendingPayment.update({
        where: { merchantOrderId: pendingPayment.merchantOrderId },
        data: { status: "COMPLETED" },
    });

    return { orderId: order.id };
}

/**
 * Run `persistOrderFromPending` inside a transaction, retrying the read once
 * if we lose the verify-vs-webhook race on the `gatewayOrderId` unique
 * constraint (P2002). The retry resolves to the order the other path created
 * — verify and webhook then both return the same orderId, so the caller
 * surfaces success either way.
 */
export async function persistOrderWithRaceGuard(
    pendingPayment: Parameters<typeof persistOrderFromPending>[1],
    gateway: GatewayPaymentInfo,
    statusComment: string,
): Promise<{ orderId: string; raced: boolean }> {
    try {
        const result = await prisma.$transaction(
            (tx) => persistOrderFromPending(tx, pendingPayment, gateway, statusComment),
        );
        return { ...result, raced: false };
    } catch (err: unknown) {
        // P2002 = unique constraint violation. The only unique we collide on
        // here is `Order.gatewayOrderId` — proof the parallel path already
        // persisted this order. Re-read and hand it back as a clean success.
        if (
            err instanceof Prisma.PrismaClientKnownRequestError
            && err.code === "P2002"
        ) {
            const existing = await prisma.order.findUnique({
                where: { gatewayOrderId: pendingPayment.merchantOrderId },
                select: { id: true },
            });
            if (existing) return { orderId: existing.id, raced: true };
        }
        throw err;
    }
}

/**
 * SHA-256 of a payload, truncated to 16 hex chars. Used purely for log
 * correlation across replays — never as a cryptographic identifier.
 */
export function hashPayload(payload: string): string {
    return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Best-effort audit insert. Swallows + logs all errors so a logging failure
 * can never break the actual payment-handling path. Intentionally fire-and-
 * forget — callers don't await this in the hot path when latency matters.
 */
export async function recordPaymentEvent(input: {
    merchantOrderId?: string | null;
    gatewayOrderId?: string | null;
    source: "verify" | "webhook";
    code?: string | null;
    status?: string | null;
    payloadHash?: string | null;
    errorMessage?: string | null;
    correlationId?: string | null;
}): Promise<void> {
    try {
        await prisma.paymentEvent.create({
            data: {
                merchantOrderId: input.merchantOrderId ?? null,
                gatewayOrderId: input.gatewayOrderId ?? null,
                source: input.source,
                code: input.code ?? null,
                status: input.status ?? null,
                payloadHash: input.payloadHash ?? null,
                errorMessage: input.errorMessage ?? null,
                correlationId: input.correlationId ?? null,
            },
        });
    } catch (err) {
        console.warn("[paymentEvent] failed to record audit row:", err);
    }
}
