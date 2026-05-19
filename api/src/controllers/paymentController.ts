import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { prisma } from "../services/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { verifyFTPFiles, extractFtpPathFromUrl, type FtpVerifyInvalidEntry } from "../services/ftp.js";
import {
    persistOrderWithRaceGuard,
    recordPaymentEvent,
    hashPayload,
    type GatewayPaymentInfo,
} from "../utils/payment-persistence.js";

type RazorpayCreateOrderResponse = {
    id?: string;
    error?: {
        description?: string;
        reason?: string;
    };
};

/**
 * Subset of Razorpay's `payment.entity` shape that we read on
 * `payment.captured` / `payment.failed`. Permissive on unknown fields — the
 * gateway adds fields over time and we don't want to fail on them.
 */
interface RazorpayPaymentEntity {
    id?: string;
    order_id?: string;
    method?: string;
    vpa?: string;
    bank?: string;
    wallet?: string;
    upi?: { vpa?: string };
    card?: { network?: string; type?: string; last4?: string; issuer?: string };
    notes?: { merchantOrderId?: string };
}

/**
 * Gather every `customDesignUrl` entry referenced by a list of order
 * items (the request body shape used by `createRazorpayOrderFromCart`).
 * De-duplicated and normalised to relative FTP paths so a single batch
 * verify covers the whole order.
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

interface RazorpayOrderEntity {
    id?: string;
    receipt?: string;
    notes?: { merchantOrderId?: string };
}

interface RazorpayWebhookPayload {
    event?: string;
    payload?: {
        payment?: { entity?: RazorpayPaymentEntity };
        order?: { entity?: RazorpayOrderEntity };
    };
}

/**
 * Create a Razorpay order from cart data. Persists a `PendingPayment` row so
 * the cart payload survives the gateway hop; the row is consumed when
 * `/payment/razorpay/verify` (or the webhook) lands.
 */
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

        // Trim + cap free-form customer comment so adversarial input can't
        // bloat the row or hold control characters.
        const trimmedComment = typeof customerComment === "string"
            ? customerComment.trim().slice(0, 2000)
            : null;

        const razorKeyId = process.env.RAZOR_LIVE_ID;
        const razorKeySecret = process.env.RAZOR_LIVE_SECRET_KEY;
        if (!razorKeyId || !razorKeySecret) {
            return sendError(res, "Razorpay is not configured", 500);
        }

        const address = await prisma.address.findFirst({
            where: { id: addressId, userId: req.user.id },
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
                400,
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

/**
 * Verify a Razorpay payment by signature and persist the resulting Order +
 * Payment from the matching `PendingPayment`. Hardened against (issue #55):
 *  - duplicate submissions (idempotent on `gatewayOrderId`)
 *  - verify-vs-webhook race (catches P2002 unique-constraint and re-reads)
 *  - mid-write failures (Order/Payment/CouponUsage/PendingPayment all in one
 *    `prisma.$transaction` so a single throw rolls everything back)
 *  - silent loss (every entry + exit branch writes a PaymentEvent row).
 */
export const verifyRazorpayPayment = async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = crypto.randomUUID();
    let merchantOrderIdForAudit: string | undefined;
    let gatewayOrderIdForAudit: string | undefined;

    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { merchantOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        if (!merchantOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            throw new ValidationError(
                "merchantOrderId, razorpayOrderId, razorpayPaymentId and razorpaySignature are required",
            );
        }
        merchantOrderIdForAudit = merchantOrderId;
        gatewayOrderIdForAudit = razorpayOrderId;

        const razorKeySecret = process.env.RAZOR_LIVE_SECRET_KEY;
        if (!razorKeySecret) {
            return sendError(res, "Razorpay is not configured", 500);
        }

        // Audit on entry — every verify hit is recorded regardless of
        // outcome, so a failed payment isn't silently invisible in prod.
        await recordPaymentEvent({
            merchantOrderId,
            gatewayOrderId: razorpayOrderId,
            source: "verify",
            code: "STARTED",
            correlationId,
            payloadHash: hashPayload(`${razorpayOrderId}|${razorpayPaymentId}`),
        });

        // Idempotency short-circuit: if we already persisted this order
        // (user double-clicked, or webhook beat verify) just hand it back.
        // We look up by Order.gatewayOrderId which carries the internal
        // merchantOrderId (column `phonePeOrderId`, retained via @map).
        const existingOrder = await prisma.order.findFirst({
            where: { gatewayOrderId: merchantOrderId, userId: req.user.id },
            select: {
                id: true,
                payments: {
                    where: { status: "SUCCESS" },
                    select: { id: true },
                    take: 1,
                },
            },
        });
        if (existingOrder && existingOrder.payments.length > 0) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId,
                source: "verify",
                code: "ALREADY_PERSISTED",
                status: "SUCCESS",
                correlationId,
            });
            return sendSuccess(res, {
                verified: true,
                orderId: existingOrder.id,
            }, "Payment already verified");
        }

        // HMAC-SHA256 signature check. Razorpay signs
        //   `${order_id}|${payment_id}`
        // with the live key secret. A mismatch means the redirect was
        // tampered with — never persist anything.
        const expectedSignature = crypto
            .createHmac("sha256", razorKeySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");
        if (expectedSignature !== razorpaySignature) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId,
                source: "verify",
                code: "SIGNATURE_FAIL",
                correlationId,
            });
            return sendSuccess(res, {
                verified: false,
                message: "Invalid Razorpay signature",
            }, "Payment verification failed");
        }

        // Locate the cart snapshot we stashed at create-order time.
        const pendingPayment = await prisma.pendingPayment.findUnique({
            where: { merchantOrderId },
        });
        if (!pendingPayment) {
            throw new NotFoundError("Pending payment not found");
        }
        if (pendingPayment.userId !== req.user.id) {
            throw new UnauthorizedError("Payment does not belong to this user");
        }

        const gatewayInfo: GatewayPaymentInfo = {
            razorpayOrderId,
            razorpayPaymentId,
            paymentInstrument: "RAZORPAY",
            paymentDetails: {
                gateway: "RAZORPAY",
                razorpayOrderId,
                razorpayPaymentId,
            },
        };

        const { orderId, raced } = await persistOrderWithRaceGuard(
            {
                merchantOrderId: pendingPayment.merchantOrderId,
                userId: pendingPayment.userId,
                addressId: pendingPayment.addressId,
                items: pendingPayment.items,
                couponCode: pendingPayment.couponCode,
                shippingCharges: pendingPayment.shippingCharges,
                customerComment: pendingPayment.customerComment ?? null,
            },
            gatewayInfo,
            "Order created after successful Razorpay payment",
        );

        await recordPaymentEvent({
            merchantOrderId,
            gatewayOrderId: razorpayOrderId,
            source: "verify",
            code: raced ? "ALREADY_PERSISTED" : "SUCCESS",
            status: "SUCCESS",
            correlationId,
        });

        return sendSuccess(res, {
            verified: true,
            orderId,
        }, "Payment verified and order created successfully");
    } catch (error) {
        await recordPaymentEvent({
            merchantOrderId: merchantOrderIdForAudit,
            gatewayOrderId: gatewayOrderIdForAudit,
            source: "verify",
            code: "ERROR",
            errorMessage: error instanceof Error ? error.message : String(error),
            correlationId,
        });
        next(error);
    }
};

/**
 * Razorpay S2S webhook. Mounted on a raw-body middleware so the HMAC over
 * the exact bytes Razorpay signed actually verifies — `express.json()` would
 * normalize the bytes and break the signature.
 *
 * Always returns 200 with an audit row describing the outcome. Razorpay
 * retries on 4xx/5xx, but a true bad signature can never be fixed by retry,
 * and a missing PendingPayment isn't recoverable either; the audit table is
 * the source of truth for triage.
 */
export const razorpayWebhook = async (req: Request, res: Response) => {
    const correlationId = crypto.randomUUID();
    // The raw-body middleware stashes the original Buffer on `req.rawBody`.
    // Fall back to JSON.stringify(req.body) only as a defensive measure;
    // signature verification will fail if we go that path, which is exactly
    // what we want — better to record INVALID_SIGNATURE than silently act.
    const rawBuf = (req as Request & { rawBody?: Buffer }).rawBody;
    const rawBody = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body);

    try {
        const signature = req.headers["x-razorpay-signature"];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret || typeof signature !== "string") {
            await recordPaymentEvent({
                source: "webhook",
                code: "INVALID_SIGNATURE",
                errorMessage: !webhookSecret
                    ? "RAZORPAY_WEBHOOK_SECRET not configured"
                    : "missing x-razorpay-signature header",
                correlationId,
                payloadHash: hashPayload(rawBody),
            });
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        // Constant-time compare to avoid leaking signature bytes via timing.
        const sigBuf = Buffer.from(signature, "utf8");
        const expBuf = Buffer.from(expectedSignature, "utf8");
        const signatureValid = sigBuf.length === expBuf.length
            && crypto.timingSafeEqual(sigBuf, expBuf);

        if (!signatureValid) {
            await recordPaymentEvent({
                source: "webhook",
                code: "INVALID_SIGNATURE",
                correlationId,
                payloadHash: hashPayload(rawBody),
            });
            // Always 200: a bad signature is a misconfiguration, not a
            // retry-able transient. Audit log is the alert path.
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        // Body is already JSON-parsed by the time we reach this handler
        // (the raw-body middleware re-parses for us).
        const payload = (req.body ?? {}) as RazorpayWebhookPayload;
        const event = payload.event;
        const paymentEntity = payload.payload?.payment?.entity;
        const orderEntity = payload.payload?.order?.entity;

        const razorpayOrderId: string | undefined = paymentEntity?.order_id ?? orderEntity?.id;
        const razorpayPaymentId: string | undefined = paymentEntity?.id;
        const merchantOrderIdFromNotes: string | undefined =
            paymentEntity?.notes?.merchantOrderId ?? orderEntity?.notes?.merchantOrderId;
        // Razorpay echoes our `receipt` (which we set to merchantOrderId at
        // create-order time) on the order entity. Notes is the primary path;
        // receipt is the fallback for `payment.captured` events that don't
        // include the order entity inline.
        const receipt: string | undefined = orderEntity?.receipt;
        const merchantOrderId = merchantOrderIdFromNotes ?? receipt;

        const payloadHash = hashPayload(rawBody);

        // payment.failed → mark Payment row FAILED. No Order creation here:
        // a failed payment never has a corresponding cart-to-persist.
        if (event === "payment.failed") {
            if (razorpayOrderId) {
                const updated = await prisma.payment.updateMany({
                    where: { gatewayProviderOrderId: razorpayOrderId },
                    data: { status: "FAILED" },
                });
                await recordPaymentEvent({
                    merchantOrderId: merchantOrderId ?? null,
                    gatewayOrderId: razorpayOrderId,
                    source: "webhook",
                    code: "PAYMENT_FAILED",
                    status: updated.count > 0 ? "FAILED" : "NOT_FOUND",
                    payloadHash,
                    correlationId,
                });
            } else {
                await recordPaymentEvent({
                    source: "webhook",
                    code: "PAYMENT_FAILED_NO_ORDER_ID",
                    payloadHash,
                    correlationId,
                });
            }
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        // We only persist orders from `payment.captured` / `order.paid`.
        // Other events (refund.*, dispute.*, etc) are no-ops for now —
        // record an audit row so we can spot patterns later.
        if (event !== "payment.captured" && event !== "order.paid") {
            await recordPaymentEvent({
                merchantOrderId: merchantOrderId ?? null,
                gatewayOrderId: razorpayOrderId ?? null,
                source: "webhook",
                code: `IGNORED:${event ?? "unknown"}`,
                payloadHash,
                correlationId,
            });
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        if (!merchantOrderId) {
            // Without merchantOrderId we have no way to locate the
            // PendingPayment row. Record + ack — manual reconciliation.
            await recordPaymentEvent({
                gatewayOrderId: razorpayOrderId ?? null,
                source: "webhook",
                code: "ORPHAN_NO_MERCHANT_ID",
                payloadHash,
                correlationId,
            });
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        // Idempotent path: if Order already exists with a successful Payment,
        // do nothing. This is the steady state once verify has won the race.
        const existingOrder = await prisma.order.findUnique({
            where: { gatewayOrderId: merchantOrderId },
            select: {
                id: true,
                payments: {
                    where: { status: "SUCCESS" },
                    select: { id: true },
                    take: 1,
                },
            },
        });
        if (existingOrder && existingOrder.payments.length > 0) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId ?? null,
                source: "webhook",
                code: "NOOP",
                status: "SUCCESS",
                payloadHash,
                correlationId,
            });
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        const pendingPayment = await prisma.pendingPayment.findUnique({
            where: { merchantOrderId },
        });
        if (!pendingPayment) {
            // PendingPayment got cleaned up before the webhook arrived AND
            // there's no Order — manual intervention territory. Audit.
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId ?? null,
                source: "webhook",
                code: "ORPHAN_NO_PENDING",
                payloadHash,
                correlationId,
            });
            return sendSuccess(res, { received: true }, "Webhook acknowledged");
        }

        // Extract instrument details when Razorpay surfaces them on
        // payment.captured. Not all event shapes carry method-specifics.
        const instrument = mapRazorpayInstrument(paymentEntity);

        const gatewayInfo: GatewayPaymentInfo = {
            razorpayOrderId: razorpayOrderId ?? "",
            razorpayPaymentId: razorpayPaymentId ?? "",
            paymentInstrument: instrument.label,
            paymentDetails: {
                gateway: "RAZORPAY",
                razorpayOrderId,
                razorpayPaymentId,
                ...instrument.details,
            },
        };

        const { orderId, raced } = await persistOrderWithRaceGuard(
            {
                merchantOrderId: pendingPayment.merchantOrderId,
                userId: pendingPayment.userId,
                addressId: pendingPayment.addressId,
                items: pendingPayment.items,
                couponCode: pendingPayment.couponCode,
                shippingCharges: pendingPayment.shippingCharges,
                customerComment: pendingPayment.customerComment ?? null,
            },
            gatewayInfo,
            "Order created from Razorpay webhook",
        );

        await recordPaymentEvent({
            merchantOrderId,
            gatewayOrderId: razorpayOrderId ?? null,
            source: "webhook",
            code: raced ? "NOOP" : "SUCCESS",
            status: "SUCCESS",
            payloadHash,
            correlationId,
            errorMessage: orderId,
        });

        return sendSuccess(res, { received: true }, "Webhook acknowledged");
    } catch (error) {
        await recordPaymentEvent({
            source: "webhook",
            code: "ERROR",
            errorMessage: error instanceof Error ? error.message : String(error),
            correlationId,
            payloadHash: hashPayload(rawBody),
        });
        // Swallow + 200 so Razorpay doesn't retry-storm us on a code bug.
        return sendSuccess(res, { received: true }, "Webhook acknowledged");
    }
};

/**
 * Map a Razorpay `payment.entity` method block to our internal
 * `(paymentInstrument, paymentDetails)` shape. Mirrors the field names
 * surfaced to the admin UI.
 */
function mapRazorpayInstrument(paymentEntity: RazorpayPaymentEntity | undefined): {
    label: string | null;
    details: Record<string, unknown>;
} {
    if (!paymentEntity) return { label: null, details: {} };
    const method = paymentEntity.method;
    switch (method) {
        case "upi":
            return {
                label: "UPI",
                details: { vpa: paymentEntity.vpa ?? paymentEntity.upi?.vpa ?? null },
            };
        case "card":
            return {
                label: "CARD",
                details: {
                    cardNetwork: paymentEntity.card?.network ?? null,
                    cardType: paymentEntity.card?.type ?? null,
                    last4: paymentEntity.card?.last4 ?? null,
                    issuer: paymentEntity.card?.issuer ?? null,
                },
            };
        case "netbanking":
            return {
                label: "NETBANKING",
                details: { bankName: paymentEntity.bank ?? null },
            };
        case "wallet":
            return {
                label: "WALLET",
                details: { walletType: paymentEntity.wallet ?? null },
            };
        default:
            return { label: method ? method.toUpperCase() : null, details: {} };
    }
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
 *                       gatewayOrderId:
 *                         type: string
 *                         nullable: true
 *                       gatewayTransactionId:
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

        // Search functionality - search by payment ID, gateway IDs, user email/name
        if (search) {
            const searchConditions: any[] = [
                { id: { contains: search } },
                { gatewayOrderId: { contains: search } },
                { gatewayTransactionId: { contains: search } },
                { gatewayProviderOrderId: { contains: search } },
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
 *                     gatewayOrderId:
 *                       type: string
 *                       nullable: true
 *                     gatewayTransactionId:
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
