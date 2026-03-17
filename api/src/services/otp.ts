import { prisma } from "./prisma.js";

// OTP expiration time (10 minutes)
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store OTP in database
 */
export async function storeOTP(email: string, otp: string): Promise<void> {
    try {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        // Delete any existing OTPs for this email
        await prisma.passwordResetOTP.deleteMany({
            where: { email },
        });

        // Create new OTP
        await prisma.passwordResetOTP.create({
            data: {
                email,
                otp,
                expiresAt,
            },
        });
    } catch (error) {
        console.error('[OTP_SERVICE] Error storing OTP:', error);
        throw error;
    }
}

/**
 * Check if OTP is valid (without deleting it)
 */
export async function checkOTP(email: string, otp: string): Promise<boolean> {
    const otpRecord = await prisma.passwordResetOTP.findFirst({
        where: {
            email,
            otp,
            expiresAt: {
                gte: new Date(), // Not expired
            },
        },
    });

    return !!otpRecord;
}

/**
 * Verify OTP (and delete it after verification - one-time use)
 */
export async function verifyOTP(email: string, otp: string): Promise<boolean> {
    const otpRecord = await prisma.passwordResetOTP.findFirst({
        where: {
            email,
            otp,
            expiresAt: {
                gte: new Date(), // Not expired
            },
        },
    });

    if (!otpRecord) {
        return false;
    }

    // Delete the OTP after successful verification (one-time use)
    await prisma.passwordResetOTP.delete({
        where: { id: otpRecord.id },
    });

    return true;
}

/**
 * Clean up expired OTPs (can be called periodically)
 */
export async function cleanupExpiredOTPs(): Promise<void> {
    await prisma.passwordResetOTP.deleteMany({
        where: {
            expiresAt: {
                lt: new Date(),
            },
        },
    });
}
