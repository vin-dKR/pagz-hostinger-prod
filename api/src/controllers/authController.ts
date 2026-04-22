import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../services/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ValidationError, UnauthorizedError, NotFoundError } from "../utils/errors.js";
import { generateOTP, storeOTP, checkOTP, verifyOTP } from "../services/otp.js";
import { sendOtpSms, normalizePhone, isValidIndianMobile } from "../services/sms.js";
import { Prisma, OTPPurpose } from "../../generated/prisma/client.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "7d";
const BCRYPT_ROUNDS = 10;

type TokenType = "customer" | "admin";

interface JwtPayload {
    userId: string;
    type: TokenType;
}

function signToken(userId: string, type: TokenType): string {
    const payload: JwtPayload = { userId, type };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function serializeUser(user: {
    id: string;
    phone: string;
    email: string | null;
    name: string | null;
    isAdmin: boolean;
    isSuperAdmin?: boolean;
}) {
    return {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        isSuperAdmin: (user as any).isSuperAdmin ?? false,
    };
}

function parseOtpPurpose(value: unknown): OTPPurpose {
    if (value === "RESET_PASSWORD") return OTPPurpose.RESET_PASSWORD;
    return OTPPurpose.SIGNUP;
}

/**
 * POST /auth/send-otp
 * Body: { phone, purpose: "SIGNUP" | "RESET_PASSWORD" }
 * - SIGNUP: phone must NOT exist in users.
 * - RESET_PASSWORD: phone must exist.
 */
export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone, purpose: rawPurpose } = req.body || {};

        if (!phone) throw new ValidationError("Phone number is required");

        const normalized = normalizePhone(phone);
        if (!isValidIndianMobile(normalized)) {
            return sendError(res, "Enter a valid 10-digit Indian mobile number", 400);
        }

        const purpose = parseOtpPurpose(rawPurpose);
        const existingUser = await prisma.user.findUnique({ where: { phone: normalized } });

        if (purpose === OTPPurpose.SIGNUP && existingUser) {
            return sendError(res, "Mobile number already registered. Please sign in.", 400);
        }
        if (purpose === OTPPurpose.RESET_PASSWORD && !existingUser) {
            return sendError(res, "No account found with this mobile number.", 404);
        }

        const otp = generateOTP();
        await storeOTP(normalized, otp, purpose);

        const smsResult = await sendOtpSms(normalized, otp, purpose);
        if (!smsResult.success) {
            return sendError(res, smsResult.error || "Failed to send OTP", 502);
        }

        return sendSuccess(
            res,
            { phone: normalized, expiresInMinutes: 10 },
            "OTP sent successfully"
        );
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/register
 * Body: { name?, phone, email?, password, otp, isAdmin?, isSuperAdmin? }
 * Requires OTP previously issued with purpose=SIGNUP.
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone, email, password, name, otp, isAdmin, isSuperAdmin } = req.body || {};

        if (!phone) throw new ValidationError("Phone number is required");
        if (!password) throw new ValidationError("Password is required");
        if (!otp) throw new ValidationError("OTP is required");
        if (password.length < 6) {
            throw new ValidationError("Password must be at least 6 characters long");
        }
        const trimmedName = name ? String(name).trim() : "";
        if (!trimmedName) {
            throw new ValidationError("Name is required");
        }

        const normalizedPhone = normalizePhone(phone);
        if (!isValidIndianMobile(normalizedPhone)) {
            return sendError(res, "Enter a valid 10-digit Indian mobile number", 400);
        }

        const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
        if (normalizedEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(normalizedEmail)) {
                return sendError(res, "Invalid email format", 400);
            }
        }

        const otpValid = await verifyOTP(normalizedPhone, String(otp), OTPPurpose.SIGNUP);
        if (!otpValid) {
            return sendError(res, "Invalid or expired OTP", 400);
        }

        const existingByPhone = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
        if (existingByPhone) {
            return sendError(res, "Mobile number already registered. Please sign in.", 400);
        }

        if (normalizedEmail) {
            const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
            if (existingByEmail) {
                return sendError(res, "Email already registered.", 400);
            }
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                phone: normalizedPhone,
                email: normalizedEmail,
                name: trimmedName,
                passwordHash,
                isAdmin: Boolean(isAdmin),
                isSuperAdmin: Boolean(isSuperAdmin),
            },
        });

        const token = signToken(user.id, user.isAdmin ? "admin" : "customer");

        return sendSuccess(
            res,
            { user: serializeUser(user), token },
            "Registration successful",
            201
        );
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const target = (error.meta?.target as string[] | undefined)?.join(",") || "";
            if (target.includes("phone")) {
                return sendError(res, "Mobile number already registered. Please sign in.", 400);
            }
            if (target.includes("email")) {
                return sendError(res, "Email already registered.", 400);
            }
            return sendError(res, "Account already exists.", 400);
        }
        next(error);
    }
};

/**
 * POST /auth/login
 * Body: { phone?, email?, password }
 * Accepts either phone (customer) or email (admin) as identifier.
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone, email, password } = req.body || {};

        if (!password) throw new ValidationError("Password is required");
        if (!phone && !email) {
            throw new ValidationError("Mobile number or email is required");
        }

        let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;

        if (phone) {
            user = await prisma.user.findUnique({ where: { phone: normalizePhone(phone) } });
        } else if (email) {
            user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
        }

        if (!user || !user.passwordHash) {
            return sendError(res, "Invalid credentials", 401);
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            return sendError(res, "Invalid credentials", 401);
        }

        const token = signToken(user.id, user.isAdmin ? "admin" : "customer");

        return sendSuccess(
            res,
            { user: serializeUser(user), token },
            "Login successful"
        );
    } catch (error) {
        next(error);
    }
};

/**
 * GET /auth/user/profile
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new UnauthorizedError("User not authenticated");

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { addresses: { orderBy: { isDefault: "desc" } } },
        });

        if (!user) throw new NotFoundError("User not found");

        return sendSuccess(res, {
            ...serializeUser(user),
            addresses: user.addresses,
            createdAt: user.createdAt,
            notificationPreferences: user.notificationPreferences || {},
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /auth/user/profile
 * Note: phone is immutable here (one user = one unique phone). Updating phone requires OTP flow.
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new UnauthorizedError("User not authenticated");

        const { name, email } = req.body || {};
        const updateData: Prisma.UserUpdateInput = {};

        if (name !== undefined) updateData.name = name ? String(name).trim() : null;

        if (email !== undefined) {
            if (email === null || email === "") {
                updateData.email = null;
            } else {
                const normalizedEmail = String(email).trim().toLowerCase();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(normalizedEmail)) {
                    return sendError(res, "Invalid email format", 400);
                }
                updateData.email = normalizedEmail;
            }
        }

        try {
            const updated = await prisma.user.update({
                where: { id: req.user.id },
                data: updateData,
                include: { addresses: { orderBy: { isDefault: "desc" } } },
            });

            return sendSuccess(
                res,
                {
                    ...serializeUser(updated),
                    addresses: updated.addresses,
                    createdAt: updated.createdAt,
                    notificationPreferences: updated.notificationPreferences || {},
                },
                "Profile updated successfully"
            );
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                return sendError(res, "Email already in use by another account", 400);
            }
            throw err;
        }
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /auth/user/password
 * Body: { currentPassword, newPassword }
 */
export const updatePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new UnauthorizedError("User not authenticated");

        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            throw new ValidationError("Current password and new password are required");
        }
        if (newPassword.length < 6) {
            throw new ValidationError("New password must be at least 6 characters long");
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) throw new NotFoundError("User not found");
        if (!user.passwordHash) {
            return sendError(res, "Password not set for this account", 400);
        }

        const match = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!match) {
            return sendError(res, "Current password is incorrect", 400);
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

        return sendSuccess(res, null, "Password updated successfully");
    } catch (error) {
        next(error);
    }
};

export const updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new UnauthorizedError("User not authenticated");

        const { preferences } = req.body || {};
        if (!preferences || typeof preferences !== "object") {
            throw new ValidationError("Preferences must be an object");
        }

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { notificationPreferences: preferences },
            include: { addresses: { orderBy: { isDefault: "desc" } } },
        });

        return sendSuccess(
            res,
            {
                ...serializeUser(updated),
                addresses: updated.addresses,
                createdAt: updated.createdAt,
                notificationPreferences: updated.notificationPreferences || {},
            },
            "Notification preferences updated successfully"
        );
    } catch (error) {
        next(error);
    }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new UnauthorizedError("User not authenticated");

        await prisma.user.delete({ where: { id: req.user.id } });

        return sendSuccess(res, null, "Account deleted successfully");
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) throw new UnauthorizedError("User not authenticated");

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundError("User not found");

        const token = signToken(user.id, user.isAdmin ? "admin" : "customer");
        return sendSuccess(res, { user: serializeUser(user), token }, "Token refreshed successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/forgot-password
 * Body: { phone }
 * Sends RESET_PASSWORD OTP.
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone } = req.body || {};
        if (!phone) throw new ValidationError("Phone number is required");

        const normalized = normalizePhone(phone);
        if (!isValidIndianMobile(normalized)) {
            return sendError(res, "Enter a valid 10-digit Indian mobile number", 400);
        }

        const user = await prisma.user.findUnique({ where: { phone: normalized } });
        if (!user) {
            return sendSuccess(
                res,
                { requiresSignup: true, message: "No account found with this mobile number. Please sign up." },
                "Account not found"
            );
        }

        const otp = generateOTP();
        await storeOTP(normalized, otp, OTPPurpose.RESET_PASSWORD);

        const smsResult = await sendOtpSms(normalized, otp, "RESET_PASSWORD");
        if (!smsResult.success) {
            return sendError(res, smsResult.error || "Failed to send OTP", 502);
        }

        return sendSuccess(
            res,
            { phone: normalized, requiresSignup: false, expiresInMinutes: 10 },
            "Password reset OTP sent"
        );
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/verify-otp
 * Body: { phone, otp, purpose? }
 * Validates without consuming (one-time consume happens in register/reset-password).
 */
export const verifyOTPController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone, otp, purpose: rawPurpose } = req.body || {};
        if (!phone || !otp) {
            throw new ValidationError("Phone and OTP are required");
        }

        const normalized = normalizePhone(phone);
        const purpose = parseOtpPurpose(rawPurpose);

        const valid = await checkOTP(normalized, String(otp), purpose);
        if (!valid) {
            return sendError(res, "Invalid or expired OTP", 400);
        }

        return sendSuccess(res, { valid: true }, "OTP verified");
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/reset-password
 * Body: { phone, otp, password }
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone, otp, password } = req.body || {};
        if (!phone || !otp || !password) {
            throw new ValidationError("Phone, OTP, and password are required");
        }
        if (password.length < 6) {
            throw new ValidationError("Password must be at least 6 characters long");
        }

        const normalized = normalizePhone(phone);
        const valid = await verifyOTP(normalized, String(otp), OTPPurpose.RESET_PASSWORD);
        if (!valid) {
            return sendError(res, "Invalid or expired OTP", 400);
        }

        const user = await prisma.user.findUnique({ where: { phone: normalized } });
        if (!user) {
            return sendError(res, "User not found", 404);
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

        return sendSuccess(res, { message: "Password has been reset successfully" }, "Password reset successful");
    } catch (error) {
        next(error);
    }
};
