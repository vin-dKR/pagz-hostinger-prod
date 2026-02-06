import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase, supabaseAdmin } from "../services/supabase.js";
import { prisma } from "../services/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ValidationError, UnauthorizedError, NotFoundError } from "../utils/errors.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Customer Registration
export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name, phone, isAdmin, isSuperAdmin } = req.body;

        if (!email || !password) {
            throw new ValidationError("Email and password are required");
        }

        // Try Supabase first
        if (supabase) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name || email.split("@")[0],
                    },
                },
            });

            if (error) {
                return sendError(res, error.message, 400);
            }

            if (data.user && data.session) {
                // Create user in our database
                const user = await prisma.user.create({
                    data: {
                        email: data.user.email || email,
                        supabaseId: data.user.id,
                        name: name || data.user.user_metadata?.name || email.split("@")[0],
                        phone: phone,
                        isAdmin: isAdmin || false,
                        isSuperAdmin: isSuperAdmin || false,
                    },
                });

                return sendSuccess(
                    res,
                    {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            phone: user.phone,
                            isAdmin: user.isAdmin,
                        },
                        token: data.session.access_token,
                    },
                    "Registration successful"
                );
            } else if (data.user) {
                // User created but no session (email confirmation required)
                const user = await prisma.user.create({
                    data: {
                        email,
                        name: name || email.split("@")[0],
                        phone,
                        supabaseId: data.user.id,
                        isAdmin,
                        isSuperAdmin
                    },
                });

                return sendSuccess(res, {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                    },
                    // No token if email confirmation is required
                }, "Registration successful. Please check your email to confirm your account.", 201);
            }
        }

        // Fallback: Local registration (without Supabase)
        // In a real scenario, you'd hash the password here
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return sendError(res, "User already exists", 400);
        }

        const user = await prisma.user.create({
            data: {
                email,
                name: name || email.split("@")[0],
                phone: phone,
                isAdmin: isAdmin || false,
                isSuperAdmin: isSuperAdmin || false,
            },
        });

        // Generate JWT token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d",
        });

        return sendSuccess(
            res,
            {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    isAdmin: user.isAdmin,
                },
                token,
            },
            "Registration successful"
        );
    } catch (error) {
        next(error);
    }
};

// Customer Login
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ValidationError("Email and password are required");
        }

        // Try Supabase first
        if (supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return sendError(res, "Invalid credentials", 401);
            }

            if (data.user && data.session) {
                // Find or create user in our database
                let user = await prisma.user.findUnique({
                    where: { supabaseId: data.user.id },
                });

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email: data.user.email || email,
                            supabaseId: data.user.id,
                            name: data.user.user_metadata?.name || email.split("@")[0],
                        },
                    });
                }

                return sendSuccess(res, {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        phone: user.phone,
                        isAdmin: user.isAdmin,
                    },
                    token: data.session.access_token, // Supabase JWT token
                }, "Login successful");
            }
        }

        // Fallback: Local login (without Supabase)
        // In a real scenario, you'd verify password hash here
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return sendError(res, "Invalid credentials", 401);
        }

        const isAdmin = user.isAdmin

        // Generate JWT token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d",
        });

        return sendSuccess(
            res,
            {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    isAdmin: user.isAdmin,
                },
                token,
            },
            "Login successful"
        );
    } catch (error) {
        next(error);
    }
};


// Get User Profile
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                addresses: {
                    orderBy: { isDefault: "desc" },
                },
            },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        return sendSuccess(res, {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            isAdmin: user.isAdmin,
            addresses: user.addresses,
            createdAt: user.createdAt,
            notificationPreferences: user.notificationPreferences || {},
        });
    } catch (error) {
        next(error);
    }
};

// Update User Profile
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { name, phone } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            include: {
                addresses: {
                    orderBy: { isDefault: "desc" },
                },
            },
        });

        return sendSuccess(res, {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            phone: updatedUser.phone,
            isAdmin: updatedUser.isAdmin,
            addresses: updatedUser.addresses,
            createdAt: updatedUser.createdAt,
            notificationPreferences: updatedUser.notificationPreferences || {},
        }, "Profile updated successfully");
    } catch (error) {
        next(error);
    }
};

// Update Password
export const updatePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw new ValidationError("Current password and new password are required");
        }

        if (newPassword.length < 6) {
            throw new ValidationError("New password must be at least 6 characters long");
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // If user has Supabase ID, update password via Supabase
        if (user.supabaseId && supabaseAdmin) {
            try {
                // First, verify current password by attempting to sign in
                if (supabase) {
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: user.email,
                        password: currentPassword,
                    });

                    if (signInError) {
                        return sendError(res, "Current password is incorrect", 400);
                    }
                }

                // If current password is correct, use admin API to update password
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    user.supabaseId,
                    { password: newPassword }
                );

                if (updateError) {
                    return sendError(res, updateError.message || "Failed to update password", 400);
                }
            } catch (supabaseError: any) {
                console.error("Error updating password in Supabase:", supabaseError);
                return sendError(res, supabaseError.message || "Failed to update password", 400);
            }
        } else {
            // If no Supabase ID, this is a local user - password update not supported without Supabase
            return sendError(res, "Password update requires Supabase authentication", 400);
        }

        return sendSuccess(res, null, "Password updated successfully");
    } catch (error) {
        next(error);
    }
};

// Update Notification Preferences
export const updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { preferences } = req.body;

        if (!preferences || typeof preferences !== 'object') {
            throw new ValidationError("Preferences must be an object");
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                notificationPreferences: preferences,
            },
            include: {
                addresses: {
                    orderBy: { isDefault: "desc" },
                },
            },
        });

        return sendSuccess(res, {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            phone: updatedUser.phone,
            isAdmin: updatedUser.isAdmin,
            addresses: updatedUser.addresses,
            createdAt: updatedUser.createdAt,
            notificationPreferences: updatedUser.notificationPreferences || {},
        }, "Notification preferences updated successfully");
    } catch (error) {
        next(error);
    }
};

// Delete User Account
export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Delete user from Supabase if supabaseId exists
        if (user.supabaseId && supabaseAdmin) {
            try {
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.supabaseId);
                if (deleteError) {
                    console.error("Error deleting user from Supabase:", deleteError);
                    // Continue with Prisma deletion even if Supabase deletion fails
                }
            } catch (supabaseError) {
                console.error("Error deleting from Supabase:", supabaseError);
                // Continue with Prisma deletion even if Supabase deletion fails
            }
        }

        // Delete user from Prisma (cascade will handle related data)
        await prisma.user.delete({
            where: { id: req.user.id },
        });

        return sendSuccess(res, null, "Account deleted successfully");
    } catch (error) {
        next(error);
    }
};

// Refresh Token
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;

        // Try Supabase refresh first if configured
        if (supabase && refreshToken) {
            const { data, error } = await supabase.auth.refreshSession({
                refresh_token: refreshToken,
            });

            if (error) {
                throw new UnauthorizedError("Invalid refresh token");
            }

            if (data.session && data.user) {
                // Get user from database
                const user = await prisma.user.findUnique({
                    where: { supabaseId: data.user.id },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        phone: true,
                        isAdmin: true,
                        isSuperAdmin: true,
                    },
                });

                if (!user) {
                    throw new NotFoundError("User not found");
                }

                return sendSuccess(
                    res,
                    {
                        user,
                        token: data.session.access_token,
                        refreshToken: data.session.refresh_token,
                        expiresAt: data.session.expires_at,
                    },
                    "Token refreshed successfully"
                );
            }
        }

        // Fallback: Use JWT-based refresh (for non-Supabase users)
        const userId = req.user?.id;

        if (!userId) {
            throw new UnauthorizedError("User not authenticated");
        }

        // Fetch fresh user data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                isAdmin: true,
                isSuperAdmin: true,
            },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Generate new JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return sendSuccess(
            res,
            {
                user,
                token,
            },
            "Token refreshed successfully"
        );
    } catch (error) {
        next(error);
    }
};
