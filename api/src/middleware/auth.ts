import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";
import { prisma } from "../services/prisma.js";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                phone: string;
                email: string | null;
                type: "customer" | "admin";
            };
        }
    }
}

interface JwtPayload {
    userId: string;
    type: "customer" | "admin";
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

function extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return authHeader.substring(7).trim() || null;
}

function decodeToken(token: string): JwtPayload {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        if (!decoded?.userId || !decoded?.type) {
            throw new UnauthorizedError("Token missing required fields. Please login again.");
        }
        return decoded;
    } catch (err: any) {
        if (err instanceof UnauthorizedError) throw err;
        if (err?.name === "TokenExpiredError") {
            throw new UnauthorizedError("Session expired. Please login again.");
        }
        throw new UnauthorizedError("Invalid or expired token");
    }
}

export const customerAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = extractToken(req);
        if (!token) throw new UnauthorizedError("No token provided");

        const decoded = decodeToken(token);
        if (decoded.type !== "customer" && decoded.type !== "admin") {
            throw new UnauthorizedError("Invalid token type");
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) throw new UnauthorizedError("User not found. Please login again.");

        req.user = {
            id: user.id,
            phone: user.phone,
            email: user.email,
            type: "customer",
        };
        return next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return sendError(res, error.message, 401);
        }
        return sendError(res, "Authentication failed", 401);
    }
};

export const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = extractToken(req);
        if (!token) throw new UnauthorizedError("No token provided");

        const decoded = decodeToken(token);
        if (decoded.type !== "admin") {
            throw new UnauthorizedError(`Admin access required.`);
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) throw new UnauthorizedError("User not found. Please login again.");
        if (!user.isAdmin) {
            throw new ForbiddenError("Admin access required. Your account does not have admin privileges.");
        }

        req.user = {
            id: user.id,
            phone: user.phone,
            email: user.email,
            type: "admin",
        };
        return next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return sendError(res, error.message, 401);
        }
        if (error instanceof ForbiddenError) {
            return sendError(res, error.message, 403);
        }
        console.error("[AUTH] Unexpected authentication error:", error);
        return sendError(res, "Authentication failed. Please try logging in again.", 401);
    }
};
