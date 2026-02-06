import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../services/supabase.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";
import { prisma } from "../services/prisma.js";

// Extend Express Request to include user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                type: "customer" | "admin";
            };
        }
    }
}

// Customer authentication using Supabase JWT
export const customerAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedError("No token provided");
        }

        const token = authHeader.substring(7);

        // Try Supabase first
        if (supabase) {
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (!error && user) {
                // Find or create user in our database
                let dbUser = await prisma.user.findUnique({
                    where: { supabaseId: user.id },
                });

                if (!dbUser) {
                    dbUser = await prisma.user.create({
                        data: {
                            email: user.email || "",
                            supabaseId: user.id,
                            name: user.user_metadata?.name || user.email?.split("@")[0],
                        },
                    });
                }

                req.user = {
                    id: dbUser.id,
                    email: dbUser.email,
                    type: "customer",
                };
                return next();
            }
        }

        // Fallback: Try local JWT verification
        const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
        try {
            const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string; type: string };

            if (decoded.type !== "customer") {
                throw new UnauthorizedError("Invalid token type");
            }

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
            });

            if (!user) {
                throw new UnauthorizedError("User not found");
            }

            req.user = {
                id: user.id,
                email: user.email,
                type: "customer",
            };
            return next();
        } catch (jwtError) {
            throw new UnauthorizedError("Invalid or expired token");
        }
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return sendError(res, error.message, 401);
        }
        return sendError(res, "Authentication failed", 401);
    }
};

// Admin authentication - verifies user is an admin
export const adminAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedError("No token provided");
        }

        const token = authHeader.substring(7);

        // Try Supabase first
        if (supabase) {
            const { data: { user }, error: supabaseError } = await supabase.auth.getUser(token);

            if (supabaseError) {
                // Supabase token validation failed - try JWT fallback
                // Log the error for debugging but don't throw yet
            } else if (user) {
                const dbUser = await prisma.user.findUnique({
                    where: { supabaseId: user.id },
                });

                if (!dbUser) {
                    throw new UnauthorizedError("User not found in database. Please contact support.");
                }

                if (!dbUser.isAdmin) {
                    throw new ForbiddenError("Admin access required");
                }

                req.user = {
                    id: dbUser.id,
                    email: dbUser.email,
                    type: "admin",
                };
                return next();
            }
        }

        // Fallback: Try local JWT verification
        const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
        try {
            const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string; type: string };

            if (!decoded.userId || !decoded.type) {
                throw new UnauthorizedError("Token missing required fields. Please login again.");
            }

            if (decoded.type !== "admin") {
                throw new UnauthorizedError(`Invalid token type: expected 'admin', got '${decoded.type}'. Please login again.`);
            }

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
            });

            if (!user) {
                throw new UnauthorizedError("User not found. Please login again.");
            }

            if (!user.isAdmin) {
                throw new ForbiddenError("Admin access required. Your account does not have admin privileges.");
            }

            req.user = {
                id: user.id,
                email: user.email,
                type: "admin",
            };
            return next();
        } catch (jwtError: any) {
            // Provide specific error messages based on JWT error type
            if (jwtError.name === 'TokenExpiredError') {
                throw new UnauthorizedError("Session expired. Please login again.");
            } else if (jwtError.name === 'JsonWebTokenError') {
                throw new UnauthorizedError("Invalid token format. Please login again.");
            } else if (jwtError.name === 'NotBeforeError') {
                throw new UnauthorizedError("Token not yet valid. Please login again.");
            } else if (jwtError instanceof UnauthorizedError || jwtError instanceof ForbiddenError) {
                // Re-throw our custom errors as-is
                throw jwtError;
            } else {
                // Generic JWT error
                throw new UnauthorizedError("Token validation failed. Please login again.");
            }
        }
    } catch (error) {
        if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
            return sendError(res, error.message, error instanceof UnauthorizedError ? 401 : 403);
        }
        // Log unexpected errors for debugging
        console.error('[AUTH] Unexpected authentication error:', error);
        return sendError(res, "Authentication failed. Please try logging in again.", 401);
    }
};
