import { prisma } from "./prisma.js";
import { OTPPurpose } from "../../generated/prisma/client.js";

const OTP_EXPIRY_MINUTES = 10;

export { OTPPurpose };

export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store OTP keyed by (phone, purpose). Upserts (deletes prior then creates).
 */
export async function storeOTP(phone: string, otp: string, purpose: OTPPurpose): Promise<void> {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.$transaction([
        prisma.phoneOTP.deleteMany({ where: { phone, purpose } }),
        prisma.phoneOTP.create({ data: { phone, otp, purpose, expiresAt } }),
    ]);
}

/**
 * Validate OTP without consuming (used for UI "verify" step before reveal of next form).
 */
export async function checkOTP(phone: string, otp: string, purpose: OTPPurpose): Promise<boolean> {
    const record = await prisma.phoneOTP.findFirst({
        where: { phone, otp, purpose, expiresAt: { gte: new Date() } },
    });
    return !!record;
}

/**
 * Validate OTP and consume it (one-time use). Returns true on success.
 */
export async function verifyOTP(phone: string, otp: string, purpose: OTPPurpose): Promise<boolean> {
    const record = await prisma.phoneOTP.findFirst({
        where: { phone, otp, purpose, expiresAt: { gte: new Date() } },
    });
    if (!record) return false;

    await prisma.phoneOTP.delete({ where: { id: record.id } });
    return true;
}

export async function cleanupExpiredOTPs(): Promise<void> {
    await prisma.phoneOTP.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
