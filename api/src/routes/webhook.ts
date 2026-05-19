import { Router, type IRouter, type Request } from "express";
import express from "express";
import { razorpayWebhook } from "../controllers/paymentController.js";

const router: IRouter = Router();

/**
 * Razorpay webhook. Mounted with `express.raw` so the HMAC signature
 * verification in the controller can hash the *exact* bytes Razorpay signed
 * (the global `express.json()` parser would normalise whitespace + key order
 * and silently invalidate the signature).
 *
 * After raw-body capture, we re-parse the JSON ourselves and attach the
 * original Buffer to `req.rawBody` for the controller to read.
 */
router.post(
    "/razorpay",
    express.raw({ type: "application/json", limit: "1mb" }),
    (req: Request & { rawBody?: Buffer }, _res, next) => {
        const raw = req.body as Buffer | undefined;
        if (Buffer.isBuffer(raw)) {
            req.rawBody = raw;
            try {
                req.body = raw.length > 0 ? JSON.parse(raw.toString("utf8")) : {};
            } catch {
                // Malformed JSON — let the controller record an audit row
                // and ack the webhook. Setting body to {} keeps downstream
                // safe.
                req.body = {};
            }
        }
        next();
    },
    razorpayWebhook,
);

export default router;
