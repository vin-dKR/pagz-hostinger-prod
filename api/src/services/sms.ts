import "dotenv/config";

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || "";
const FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";
const FAST2SMS_ROUTE = process.env.FAST2SMS_ROUTE || "dlt";
const FAST2SMS_SENDER_ID = process.env.FAST2SMS_SENDER_ID || "";
const FAST2SMS_TEMPLATE_ID = process.env.FAST2SMS_TEMPLATE_ID || "";
const FAST2SMS_MESSAGE_TEMPLATE =
    process.env.FAST2SMS_MESSAGE_TEMPLATE ||
    "Your PAGZ verification code is {otp}. Valid for 10 minutes.";
const FAST2SMS_OTP_MINUTES = process.env.FAST2SMS_OTP_MINUTES || "10";
const DEV_LOG_OTPS = process.env.SMS_DEV_LOG_OTPS === "true";

/**
 * Normalize phone to 10-digit Indian mobile.
 */
export function normalizePhone(raw: string): string {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    return digits;
}

export function isValidIndianMobile(phone: string): boolean {
    const n = normalizePhone(phone);
    return /^[6-9]\d{9}$/.test(n);
}

/**
 * Substitute {otp} and {minutes} placeholders in a template.
 *
 * Tolerates shell-escaped braces from dotenv (\{otp\}, \{minutes\}) — some
 * prod deployments escape braces when piping env values through shells
 * or dashboard UIs, which would otherwise leave the literal placeholder
 * in the delivered SMS.
 */
function renderTemplate(template: string, otp: string, minutes: string): string {
    return template
        .replace(/\\([{}])/g, "$1")
        .replace(/\{otp\}/g, otp)
        .replace(/\{minutes\}/g, minutes);
}

export interface SendSmsResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Send OTP SMS via Fast2SMS.
 *
 * Supported routes (configure via FAST2SMS_ROUTE env):
 *  - "otp":         Fast2SMS built-in OTP template. Requires website verification on Fast2SMS account.
 *                   Params: variables_values=<OTP>, numbers=<PHONE>.
 *  - "dlt" (default): DLT-approved template with variable substitution.
 *                   Env: FAST2SMS_SENDER_ID (e.g. HRNGPZ), FAST2SMS_TEMPLATE_ID (DLT message ID, numeric).
 *                   Params: sender_id, message=<TEMPLATE_ID>, variables_values=<OTP>, numbers=<PHONE>.
 *  - "dlt_manual":  DLT route with full message text inline (must match approved template verbatim).
 *                   Env: FAST2SMS_SENDER_ID, FAST2SMS_MESSAGE_TEMPLATE (use {otp} placeholder).
 *                   Params: sender_id, message=<resolved text>, numbers=<PHONE>.
 *  - "q" (transactional quick): no sender_id needed, message is full text.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SendSmsResult> {
    const to = normalizePhone(phone);

    if (!isValidIndianMobile(to)) {
        return { success: false, error: "Invalid mobile number" };
    }

    if (DEV_LOG_OTPS) {
        console.log(`[SMS_DEV] phone=${to} otp=${otp}`);
    }

    if (!FAST2SMS_API_KEY) {
        return { success: false, error: "FAST2SMS_API_KEY not configured" };
    }

    const params = new URLSearchParams();
    params.set("authorization", FAST2SMS_API_KEY);
    params.set("route", FAST2SMS_ROUTE);
    params.set("numbers", to);
    params.set("flash", "0");

    switch (FAST2SMS_ROUTE) {
        case "otp":
            params.set("variables_values", otp);
            break;

        case "dlt":
            if (!FAST2SMS_SENDER_ID || !FAST2SMS_TEMPLATE_ID) {
                return {
                    success: false,
                    error: "DLT route requires FAST2SMS_SENDER_ID and FAST2SMS_TEMPLATE_ID env vars",
                };
            }
            params.set("sender_id", FAST2SMS_SENDER_ID);
            params.set("message", FAST2SMS_TEMPLATE_ID);
            params.set("variables_values", `${otp}|${FAST2SMS_OTP_MINUTES}`);
            break;

        case "dlt_manual":
            if (!FAST2SMS_SENDER_ID) {
                return { success: false, error: "dlt_manual route requires FAST2SMS_SENDER_ID" };
            }
            params.set("sender_id", FAST2SMS_SENDER_ID);
            params.set("message", renderTemplate(FAST2SMS_MESSAGE_TEMPLATE, otp, FAST2SMS_OTP_MINUTES));
            break;

        case "q":
        default:
            params.set("message", renderTemplate(FAST2SMS_MESSAGE_TEMPLATE, otp, FAST2SMS_OTP_MINUTES));
            break;
    }

    const url = `${FAST2SMS_ENDPOINT}?${params.toString()}`;

    try {
        const res = await fetch(url, { method: "GET" });

        const body = (await res.json().catch(() => ({}))) as {
            return?: boolean;
            status_code?: number;
            message?: string | string[];
            error?: string;
            request_id?: string | string[];
        };

        if (!res.ok || body?.return === false) {
            const rawErr = body?.message || body?.error || `Fast2SMS HTTP ${res.status}`;
            const errMsg = Array.isArray(rawErr) ? rawErr.join(", ") : rawErr;
            console.error("[SMS] Fast2SMS error:", errMsg, body);
            return { success: false, error: typeof errMsg === "string" ? errMsg : "SMS delivery failed" };
        }

        const messageId = Array.isArray(body?.request_id) ? body.request_id[0] : body?.request_id;
        return { success: true, messageId };
    } catch (err) {
        console.error("[SMS] Fast2SMS request failed:", err);
        const message = err instanceof Error ? err.message : "SMS service unavailable";
        return { success: false, error: message };
    }
}
