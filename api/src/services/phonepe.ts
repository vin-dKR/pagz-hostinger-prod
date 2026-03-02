import crypto from "crypto";

const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || "";
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || "";
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
const PHONEPE_ENV = process.env.PHONEPE_ENV || "SANDBOX";

const BASE_URL =
    PHONEPE_ENV === "PRODUCTION"
        ? "https://api.phonepe.com/apis/hermes"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox";

export const phonePeConfig = {
    merchantId: PHONEPE_MERCHANT_ID,
    saltKey: PHONEPE_SALT_KEY,
    saltIndex: PHONEPE_SALT_INDEX,
    baseUrl: BASE_URL,
    isConfigured: Boolean(PHONEPE_MERCHANT_ID && PHONEPE_SALT_KEY),
};

/**
 * Initiate a PhonePe payment (PAY_PAGE redirect flow)
 */
export async function initiatePhonePePayment(params: {
    merchantTransactionId: string;
    amount: number; // in paise
    redirectUrl: string;
    callbackUrl: string;
    merchantUserId: string;
}): Promise<{ redirectUrl: string }> {
    const payload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: params.merchantTransactionId,
        merchantUserId: params.merchantUserId,
        amount: params.amount,
        redirectUrl: params.redirectUrl,
        redirectMode: "REDIRECT",
        callbackUrl: params.callbackUrl,
        paymentInstrument: { type: "PAY_PAGE" },
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const verificationString = payloadBase64 + "/pg/v1/pay" + PHONEPE_SALT_KEY;
    const sha256Hash = crypto.createHash("sha256").update(verificationString).digest("hex");
    const xVerify = sha256Hash + "###" + PHONEPE_SALT_INDEX;

    const response = await fetch(`${BASE_URL}/pg/v1/pay`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerify,
            accept: "application/json",
        },
        body: JSON.stringify({ request: payloadBase64 }),
    });

    const data = (await response.json()) as any;

    if (!data.success) {
        throw new Error(data.message || "PhonePe payment initiation failed");
    }

    const redirectUrl = data.data?.instrumentResponse?.redirectInfo?.url;
    if (!redirectUrl) {
        throw new Error("No redirect URL received from PhonePe");
    }

    return { redirectUrl };
}

/**
 * Check payment status with PhonePe
 */
export async function checkPhonePePaymentStatus(merchantTransactionId: string) {
    const statusPath = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
    const verificationString = statusPath + PHONEPE_SALT_KEY;
    const sha256Hash = crypto.createHash("sha256").update(verificationString).digest("hex");
    const xVerify = sha256Hash + "###" + PHONEPE_SALT_INDEX;

    const response = await fetch(`${BASE_URL}${statusPath}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerify,
            accept: "application/json",
        },
    });

    const data = (await response.json()) as any;

    // Extract payment instrument details
    const instrument = data.data?.paymentInstrument;
    let paymentInstrument: string | null = null;
    let paymentDetails: Record<string, any> | null = null;

    if (instrument) {
        paymentInstrument = instrument.type || null; // UPI, CARD, NETBANKING, WALLET

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

    return {
        success: data.success === true,
        code: data.code || "",
        state:
            data.code === "PAYMENT_SUCCESS"
                ? "COMPLETED"
                : data.code === "PAYMENT_PENDING"
                    ? "PENDING"
                    : "FAILED",
        transactionId: data.data?.transactionId,
        amount: data.data?.amount,
        paymentInstrument,
        paymentDetails,
    };
}

/**
 * Verify PhonePe S2S callback signature
 */
export function verifyPhonePeCallback(xVerifyHeader: string, responseBody: string): boolean {
    const sha256Hash = crypto
        .createHash("sha256")
        .update(responseBody + PHONEPE_SALT_KEY)
        .digest("hex");
    const expectedVerify = sha256Hash + "###" + PHONEPE_SALT_INDEX;
    return xVerifyHeader === expectedVerify;
}
