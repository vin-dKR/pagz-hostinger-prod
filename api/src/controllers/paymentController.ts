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
    type AmountMismatchSnapshot,
} from "../utils/payment-persistence.js";

/**
 * Serialise an `AmountMismatchSnapshot` into a short, log-friendly string.
 * The payload is small enough to fit in `PaymentEvent.errorMessage` (TEXT)
 * so ops can grep for `AMOUNT_MISMATCH` rows and read the breakdown without
 * joining another table.
 */
const formatAmountMismatch = (m: AmountMismatchSnapshot): string => {
    return [
        `paid=${m.paidAmount.toFixed(2)}`,
        `recomputed=${m.recomputedTotal.toFixed(2)}`,
        `subtotal=${m.subtotal.toFixed(2)}`,
        `addons=${m.addonsSubtotal.toFixed(2)}`,
        `discount=${m.discountAmount.toFixed(2)}`,
        `shipping=${m.shippingCharges.toFixed(2)}`,
    ].join(" ");
};

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
 * Normalise a `customDesignUrl` value (string | string[] | unknown) to a
 * deduped, trimmed string[]. Returned in stable order — caller-side
 * comparisons can rely on identical input producing identical output.
 */
function normalizeDesignUrlsLocal(value: unknown): string[] {
    if (!value) return [];
    const raw: string[] = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : typeof value === "string"
            ? [value]
            : [];
    const seen = new Set<string>();
    for (const entry of raw) {
        const trimmed = entry.trim();
        if (trimmed) seen.add(trimmed);
    }
    return Array.from(seen);
}

/**
 * Per-uploaded-file pricing metadata as stored in
 * `CartItem.metadata.files`. The shape is intentionally narrow — we only
 * need `url` and `pageCount` here; the engine sanitises anything else.
 */
interface CartFileMetaEntry {
    url: string;
    pageCount: number;
}

/**
 * Phase 0 / issue #74 — backfill missing `metadata.files` on the payload
 * we're about to freeze into `PendingPayment.items` by looking up the
 * user's CartItem rows and copying their persisted `files` array over.
 *
 * Why: between cart-write and create-order-from-cart, an intermediate
 * web-side path (cart sweep, file re-upload, addon toggle, manual
 * `updateCartItem` calls) can submit a `metadata` blob that overwrites
 * the row's metadata WITHOUT including the per-file `files` array — old
 * `getCart` responses are spread back through `updatedMetadata` and a
 * missing key never gets restored client-side. The result is a cart row
 * whose preview total ran with `metadata.files` (computed live by
 * `getCart`) but whose payload to `/create-order-from-cart` arrives
 * without it. Persist-time then takes the `perFileEvaluation` aggregate
 * fallback and mis-prices the addon (issue #74).
 *
 * Server-side enrichment closes the loop: whatever the client sent, the
 * pending payment carries the cart's own `metadata.files` array if the
 * cart row has one. Per-item match is by `(productId, customDesignUrl set)`
 * — exact URL set match guarantees we don't paste a different cart row's
 * files onto an item the user just hand-edited.
 *
 * No-op when:
 *   - the item already has `metadata.files` (client knew about them).
 *   - no matching CartItem row exists (buyNow flow, deleted row, etc.).
 *   - the matching CartItem also lacks `metadata.files`.
 */
async function enrichItemsWithCartFiles(
    items: unknown[],
    userId: string,
): Promise<unknown[]> {
    // Pull every CartItem the user owns once; we'll match in memory.
    const cartItems = await prisma.cartItem.findMany({
        where: { cart: { userId } },
        select: {
            productId: true,
            customDesignUrl: true,
            metadata: true,
        },
    });
    if (cartItems.length === 0) return items;

    // Index by (productId + sorted customDesignUrl set) for O(1) lookup.
    const index = new Map<string, CartFileMetaEntry[] | null>();
    for (const ci of cartItems) {
        const urls = normalizeDesignUrlsLocal(ci.customDesignUrl).sort();
        if (urls.length === 0) continue;
        const key = `${ci.productId}::${urls.join("|")}`;
        const metaFiles = (ci.metadata as { files?: unknown } | null | undefined)?.files;
        if (!Array.isArray(metaFiles) || metaFiles.length === 0) {
            index.set(key, null);
            continue;
        }
        // Defensive: clone, validate the shape, drop garbage entries.
        const sanitized: CartFileMetaEntry[] = [];
        for (const entry of metaFiles) {
            if (!entry || typeof entry !== "object") continue;
            const e = entry as { url?: unknown; pageCount?: unknown };
            const url = typeof e.url === "string" ? e.url.trim() : "";
            const pageCount = Number(e.pageCount);
            if (!url || !Number.isFinite(pageCount) || pageCount < 0) continue;
            sanitized.push({ url, pageCount: Math.floor(pageCount) });
        }
        index.set(key, sanitized.length > 0 ? sanitized : null);
    }

    return items.map((item) => {
        const it = item as {
            productId?: unknown;
            customDesignUrl?: unknown;
            metadata?: unknown;
        };
        const productId = typeof it.productId === "string" ? it.productId : "";
        if (!productId) return item;

        // Already has files — trust the client, don't second-guess.
        const existing = (it.metadata as { files?: unknown } | null | undefined)?.files;
        if (Array.isArray(existing) && existing.length > 0) return item;

        const urls = normalizeDesignUrlsLocal(it.customDesignUrl).sort();
        if (urls.length === 0) return item;
        const key = `${productId}::${urls.join("|")}`;
        const recovered = index.get(key);
        if (!recovered || recovered.length === 0) return item;

        // Stamp the recovered files onto a shallow clone — never mutate
        // the caller's object so this helper stays referentially safe.
        const meta = (it.metadata && typeof it.metadata === "object")
            ? { ...(it.metadata as Record<string, unknown>) }
            : {};
        meta.files = recovered;
        console.warn(
            "[create-order] backfilled metadata.files from cart row",
            { productId, urlsCount: urls.length, recoveredCount: recovered.length },
        );
        return { ...(item as Record<string, unknown>), metadata: meta };
    });
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

        // Issue #74 — backfill `metadata.files` from the user's cart rows
        // when the request payload is missing it. Closes a class of
        // checkout-side mapping bugs (cart sweep, addon toggle, etc.)
        // that strip `files` from the payload while the cart row in DB
        // still has the authoritative per-file metadata. Without this,
        // perFileEvaluation addons silently fall back to the aggregate
        // path at persist time and the order total drifts from what the
        // customer paid.
        const enrichedItems = await enrichItemsWithCartFiles(
            items as unknown[],
            req.user.id,
        );

        await prisma.pendingPayment.create({
            data: {
                merchantOrderId,
                userId: req.user.id,
                addressId,
                items: JSON.parse(JSON.stringify(enrichedItems)),
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

        const { orderId, raced, mismatch, missingFiles } = await persistOrderWithRaceGuard(
            {
                merchantOrderId: pendingPayment.merchantOrderId,
                userId: pendingPayment.userId,
                addressId: pendingPayment.addressId,
                items: pendingPayment.items,
                amount: pendingPayment.amount,
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

        // Phase 5 audit (issue #74) — if the recomputed total drifted from
        // what the customer was actually charged, log the breakdown so ops
        // can chase the pricing bug without it ever affecting persisted
        // amounts (Order.total + Payment.amount are already locked to the
        // gateway-charged value inside persistOrderFromPending).
        if (mismatch && !raced) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId,
                source: "verify",
                code: "AMOUNT_MISMATCH",
                status: "SUCCESS",
                correlationId,
                errorMessage: formatAmountMismatch(mismatch),
            });
        }

        // Issue #86 — reference-integrity audit. The customer has paid
        // and the order is persisted; if any referenced design file was
        // missing on FTP at persist time, record it so support can chase
        // the file before the customer hits the order-detail 404. We
        // don't refund or block here (paid-already invariant); the
        // event is the forensic breadcrumb.
        if (missingFiles && missingFiles.length > 0 && !raced) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId,
                source: "verify",
                code: "MISSING_FILE_AT_PERSIST",
                status: "SUCCESS",
                correlationId,
                errorMessage: missingFiles.join(", "),
            });
        }

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

        const { orderId, raced, mismatch, missingFiles } = await persistOrderWithRaceGuard(
            {
                merchantOrderId: pendingPayment.merchantOrderId,
                userId: pendingPayment.userId,
                addressId: pendingPayment.addressId,
                items: pendingPayment.items,
                amount: pendingPayment.amount,
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

        // Phase 5 audit (issue #74) — see verifyRazorpayPayment for the
        // rationale. Mirrored here so the webhook path emits the same
        // signal when it is the surface that actually persisted the order.
        if (mismatch && !raced) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId ?? null,
                source: "webhook",
                code: "AMOUNT_MISMATCH",
                status: "SUCCESS",
                payloadHash,
                correlationId,
                errorMessage: formatAmountMismatch(mismatch),
            });
        }

        // Issue #86 — reference-integrity audit. Mirrors the verify path
        // so the webhook also leaves a `MISSING_FILE_AT_PERSIST` row
        // when it's the surface that actually persisted the order.
        if (missingFiles && missingFiles.length > 0 && !raced) {
            await recordPaymentEvent({
                merchantOrderId,
                gatewayOrderId: razorpayOrderId ?? null,
                source: "webhook",
                code: "MISSING_FILE_AT_PERSIST",
                status: "SUCCESS",
                payloadHash,
                correlationId,
                errorMessage: missingFiles.join(", "),
            });
        }

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
// Admin: list orphan PendingPayments — rows that have no matching Order.
// Surfaces the "Razorpay captured but no Order in DB" class of failures
// (transaction timeout, pool exhaustion, webhook never fired, ...).
// Each row is the recovery candidate for `POST /admin/payments/recover/:merchantOrderId`.
export const getOrphanPendingPayments = async (
    _req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        // Lookback window — payments older than 30 days are out of scope.
        const lookback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const pendings = await prisma.pendingPayment.findMany({
            where: {
                createdAt: { gte: lookback },
                // PendingPayment.status flips to 'PROCESSED' (or whatever
                // the persist path writes) once an Order is created.
                // Stuck rows stay in 'PENDING'.
                status: "PENDING",
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        // For each, check if an Order exists for that merchantOrderId.
        // We do this in a single batch query rather than per-row.
        const merchantIds = pendings.map((p) => p.merchantOrderId);
        const matchedOrders = merchantIds.length === 0 ? [] : await prisma.order.findMany({
            where: { gatewayOrderId: { in: merchantIds } },
            select: { gatewayOrderId: true, id: true },
        });
        const orderByMerchantId = new Map(matchedOrders.map((o) => [o.gatewayOrderId, o.id]));

        const orphans = pendings
            .filter((p) => !orderByMerchantId.has(p.merchantOrderId))
            .map((p) => ({
                merchantOrderId: p.merchantOrderId,
                userId: p.userId,
                amount: Number(p.amount),
                addressId: p.addressId,
                couponCode: p.couponCode,
                createdAt: p.createdAt,
                expiresAt: p.expiresAt,
                itemCount: Array.isArray(p.items) ? (p.items as unknown[]).length : 0,
            }));

        return sendSuccess(res, { orphans, count: orphans.length });
    } catch (error) {
        next(error);
    }
};

// Admin: manually recover a stuck payment by replaying persistOrderFromPending.
// Use case: Razorpay captured, but the persist transaction errored out
// (timeout, pool exhaustion). PendingPayment + PaymentEvent rows are
// intact — this endpoint locates the gateway capture details from
// Razorpay (via the merchantOrderId) and runs the same persistence path
// the webhook/verify would have, with the timeout fix in place.
export const recoverStuckPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const rawMerchantOrderId = req.params.merchantOrderId;
        const merchantOrderId = typeof rawMerchantOrderId === "string" ? rawMerchantOrderId : "";
        if (!merchantOrderId) {
            throw new ValidationError("merchantOrderId is required");
        }

        const pending = await prisma.pendingPayment.findUnique({
            where: { merchantOrderId },
        });
        if (!pending) {
            throw new NotFoundError(`PendingPayment ${merchantOrderId} not found`);
        }

        // If an Order already exists for this merchantOrderId, nothing to do.
        const existing = await prisma.order.findUnique({
            where: { gatewayOrderId: merchantOrderId },
            select: { id: true },
        });
        if (existing) {
            return sendSuccess(res, {
                orderId: existing.id,
                alreadyExisted: true,
            }, "Order already exists for this merchantOrderId");
        }

        // Admin must supply the Razorpay payment ID (from Razorpay dashboard).
        // Without it we can't link the Payment row back to the gateway charge.
        const rawPaymentId = req.body?.razorpayPaymentId;
        const rawOrderId = req.body?.razorpayOrderId;
        const razorpayPaymentId = typeof rawPaymentId === "string" ? rawPaymentId : "";
        const razorpayOrderId = typeof rawOrderId === "string" ? rawOrderId : "";
        if (!razorpayPaymentId || !razorpayOrderId) {
            throw new ValidationError(
                "razorpayPaymentId and razorpayOrderId are required in body (copy from Razorpay dashboard).",
            );
        }

        const correlationId = uuidv4();
        const { orderId, raced } = await persistOrderWithRaceGuard(
            pending,
            {
                razorpayOrderId,
                razorpayPaymentId,
                paymentInstrument: "RAZORPAY",
                paymentDetails: {
                    gateway: "RAZORPAY",
                    razorpayOrderId,
                    razorpayPaymentId,
                    recoveredManually: true,
                    recoveredAt: new Date().toISOString(),
                },
            } as Parameters<typeof persistOrderWithRaceGuard>[1],
            "Order recovered manually by admin from stuck payment",
        );

        // Audit the manual recovery. Reuse `source: 'verify'` since the
        // event-source enum only covers the two automatic paths; the
        // `code` and `errorMessage` carry the manual-recovery flag.
        await recordPaymentEvent({
            merchantOrderId,
            gatewayOrderId: razorpayOrderId,
            source: "verify",
            code: raced ? "ALREADY_PERSISTED" : "ADMIN_RECOVERED",
            status: "success",
            errorMessage: "Manually recovered via /admin/payments/recover",
            correlationId,
        });

        return sendSuccess(res, {
            orderId,
            raced,
            correlationId,
        }, raced ? "Order already existed (race)" : "Order created successfully");
    } catch (error) {
        next(error);
    }
};

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
