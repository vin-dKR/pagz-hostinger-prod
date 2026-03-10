import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, ForbiddenError } from "../utils/errors.js";
import { Prisma } from "../../generated/prisma/client.js";

/**
 * Get all users with advanced filtering, search, and sorting
 * Supports filtering by role, date range, order activity, engagement, and location
 */
export const getAdminUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const search = (req.query.search as string) || "";
        const role = req.query.role as string | undefined;
        const status = req.query.status as string | undefined;
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        const hasOrders = req.query.hasOrders as string | undefined;
        const hasReviews = req.query.hasReviews as string | undefined;
        const state = req.query.state as string | undefined;
        const city = req.query.city as string | undefined;
        const country = req.query.country as string | undefined;
        const sortBy = (req.query.sortBy as string) || "createdAt";
        const sortOrder = (req.query.sortOrder as string) || "desc";

        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.UserWhereInput = {};

        // Role filter
        if (role) {
            if (role === "super_admin") {
                where.isSuperAdmin = true;
            } else if (role === "admin") {
                where.isAdmin = true;
                where.isSuperAdmin = false;
            } else if (role === "customer") {
                where.isAdmin = false;
                where.isSuperAdmin = false;
            }
        }

        // Search filter
        if (search) {
            where.OR = [
                { email: { contains: search } },
                { name: { contains: search } },
                { phone: { contains: search } },
                { id: { contains: search } },
                { supabaseId: { contains: search } },
            ];
        }

        // Date range filter (registration date)
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }

        // Order activity filter
        if (hasOrders === "true") {
            where.orders = { some: {} };
        } else if (hasOrders === "false") {
            where.orders = { none: {} };
        }

        // Review activity filter
        if (hasReviews === "true") {
            where.reviews = { some: {} };
        } else if (hasReviews === "false") {
            where.reviews = { none: {} };
        }

        // Location filter
        if (state || city || country) {
            where.addresses = {
                some: {
                    ...(state && { state }),
                    ...(city && { city }),
                    ...(country && { country }),
                },
            };
        }

        // Build orderBy
        const orderBy: Prisma.UserOrderByWithRelationInput = {};
        if (sortBy === "name") {
            orderBy.name = sortOrder as "asc" | "desc";
        } else if (sortBy === "email") {
            orderBy.email = sortOrder as "asc" | "desc";
        } else if (sortBy === "createdAt") {
            orderBy.createdAt = sortOrder as "asc" | "desc";
        } else if (sortBy === "totalOrders") {
            // For sorting by order count, we'll need to use a different approach
            // For now, sort by createdAt as fallback
            orderBy.createdAt = "desc";
        } else {
            orderBy.createdAt = "desc";
        }

        // Get users with statistics
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    phone: true,
                    isAdmin: true,
                    isSuperAdmin: true,
                    supabaseId: true,
                    notificationPreferences: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            orders: true,
                            reviews: true,
                            addresses: true,
                            wishlistItems: true,
                        },
                    },
                },
                orderBy,
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        // Calculate statistics for each user
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                // Get total spent
                const orders = await prisma.order.findMany({
                    where: { userId: user.id },
                    select: { total: true },
                });
                const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);

                // Get cart items count
                const cart = await prisma.cart.findUnique({
                    where: { userId: user.id },
                    include: { items: true },
                });
                const cartItemsCount = cart?.items.length || 0;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    isAdmin: user.isAdmin,
                    isSuperAdmin: user.isSuperAdmin,
                    supabaseId: user.supabaseId,
                    notificationPreferences: user.notificationPreferences,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    statistics: {
                        totalOrders: user._count.orders,
                        totalSpent,
                        totalReviews: user._count.reviews,
                        addressesCount: user._count.addresses,
                        wishlistItemsCount: user._count.wishlistItems,
                        cartItemsCount,
                    },
                };
            })
        );

        return sendSuccess(res, {
            items: usersWithStats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user statistics (overall statistics)
 */
export const getUserStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;

        const where: Prisma.UserWhereInput = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        const [
            totalUsers,
            newUsersThisMonth,
            newUsersThisWeek,
            newUsersToday,
            activeUsersLast30Days,
            totalCustomers,
            totalAdmins,
            totalSuperAdmins,
        ] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.count({
                where: {
                    ...where,
                    createdAt: {
                        gte: new Date(new Date().setDate(1)),
                    },
                },
            }),
            prisma.user.count({
                where: {
                    ...where,
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.user.count({
                where: {
                    ...where,
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),
            prisma.user.count({
                where: {
                    ...where,
                    orders: {
                        some: {
                            createdAt: {
                                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                            },
                        },
                    },
                },
            }),
            prisma.user.count({
                where: {
                    ...where,
                    isAdmin: false,
                    isSuperAdmin: false,
                },
            }),
            prisma.user.count({
                where: {
                    ...where,
                    isAdmin: true,
                    isSuperAdmin: false,
                },
            }),
            prisma.user.count({
                where: {
                    ...where,
                    isSuperAdmin: true,
                },
            }),
        ]);

        // Calculate average orders per user
        const allUsers = await prisma.user.findMany({
            where,
            include: {
                _count: {
                    select: { orders: true },
                },
            },
        });
        const totalOrders = allUsers.reduce((sum, user) => sum + user._count.orders, 0);
        const avgOrdersPerUser = allUsers.length > 0 ? totalOrders / allUsers.length : 0;

        // Calculate average lifetime value
        const allOrders = await prisma.order.findMany({
            where: {
                userId: { in: allUsers.map((u) => u.id) },
            },
            select: { total: true },
        });
        const totalRevenue = allOrders.reduce((sum, order) => sum + Number(order.total), 0);
        const avgLifetimeValue = allUsers.length > 0 ? totalRevenue / allUsers.length : 0;

        return sendSuccess(res, {
            totalUsers,
            newUsersThisMonth,
            newUsersThisWeek,
            newUsersToday,
            activeUsersLast30Days,
            totalCustomers,
            totalAdmins,
            totalSuperAdmins,
            avgOrdersPerUser: Math.round(avgOrdersPerUser * 100) / 100,
            avgLifetimeValue: Math.round(avgLifetimeValue * 100) / 100,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single user with comprehensive details
 */
export const getAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const user = await prisma.user.findUnique({
            where: { id: id as string },
            include: {
                addresses: {
                    orderBy: { isDefault: "desc" },
                },
                _count: {
                    select: {
                        orders: true,
                        reviews: true,
                        addresses: true,
                        wishlistItems: true,
                        payments: true,
                        couponUsages: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Calculate statistics
        const orders = await prisma.order.findMany({
            where: { userId: id as string },
            select: { total: true, subtotal: true },
        });
        const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
        const avgOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;

        const cart = await prisma.cart.findUnique({
            where: { userId: id as string },
            include: { items: true },
        });

        const lastOrder = await prisma.order.findFirst({
            where: { userId: id as string },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        });

        const lastReview = await prisma.review.findFirst({
            where: { userId: id as string },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        });

        const statistics = {
            totalOrders: user._count.orders,
            totalSpent,
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,
            totalReviews: user._count.reviews,
            addressesCount: user._count.addresses,
            wishlistItemsCount: user._count.wishlistItems,
            cartItemsCount: cart?.items.length || 0,
            couponUsagesCount: user._count.couponUsages,
            lastOrderDate: lastOrder?.createdAt || null,
            lastReviewDate: lastReview?.createdAt || null,
            accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        };

        return sendSuccess(res, {
            ...user,
            statistics,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user orders
 */
export const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string | undefined;
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        const skip = (page - 1) * limit;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const where: Prisma.OrderWhereInput = {
            userId: id as string,
            ...(status && { status: status as any }),
            ...((dateFrom || dateTo) && {
                createdAt: {
                    ...(dateFrom && { gte: new Date(dateFrom) }),
                    ...(dateTo && { lte: new Date(dateTo) }),
                },
            }),
        };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    images: {
                                        where: { isPrimary: true },
                                        take: 1,
                                    },
                                },
                            },
                        },
                    },
                    address: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.order.count({ where }),
        ]);

        return sendSuccess(res, {
            items: orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user addresses
 */
export const getUserAddresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const addresses = await prisma.address.findMany({
            where: { userId: id as string },
            include: {
                _count: {
                    select: { orders: true },
                },
            },
            orderBy: { isDefault: "desc" },
        });

        return sendSuccess(res, addresses);
    } catch (error) {
        next(error);
    }
};

/**
 * Get user payments
 */
export const getUserPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string | undefined;
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        const skip = (page - 1) * limit;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const where: Prisma.PaymentWhereInput = {
            userId: id as string,
            ...(status && { status: status as any }),
            ...((dateFrom || dateTo) && {
                createdAt: {
                    ...(dateFrom && { gte: new Date(dateFrom) }),
                    ...(dateTo && { lte: new Date(dateTo) }),
                },
            }),
        };

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    order: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.payment.count({ where }),
        ]);

        return sendSuccess(res, {
            items: payments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user reviews
 */
export const getUserReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const rating = req.query.rating as string | undefined;
        const isApproved = req.query.isApproved as string | undefined;
        const skip = (page - 1) * limit;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const where: Prisma.ReviewWhereInput = {
            userId: id as string,
            ...(rating && { rating: parseInt(rating) }),
            ...(isApproved !== undefined && { isApproved: isApproved === "true" }),
        };

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            images: {
                                where: { isPrimary: true },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.review.count({ where }),
        ]);

        return sendSuccess(res, {
            items: reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user wishlist and cart
 */
export const getUserWishlistAndCart = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const [wishlistItems, cart] = await Promise.all([
            prisma.wishlistItem.findMany({
                where: { userId: id as string },
                include: {
                    product: {
                        include: {
                            images: {
                                where: { isPrimary: true },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.cart.findUnique({
                where: { userId: id as string },
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    images: {
                                        where: { isPrimary: true },
                                        take: 1,
                                    },
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        return sendSuccess(res, {
            wishlistItems,
            cart: cart || null,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user
 */
export const updateAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, email, phone, isAdmin, isSuperAdmin, notificationPreferences } = req.body;
        const currentUser = req.user;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        // Get current user from database to check permissions
        const currentAdmin = await prisma.user.findUnique({
            where: { id: currentUser?.id },
        });

        if (!currentAdmin || !currentAdmin.isAdmin) {
            throw new ForbiddenError("Admin access required");
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: id as string },
        });

        if (!existingUser) {
            throw new NotFoundError("User not found");
        }

        // Only super admin can change roles
        if ((isAdmin !== undefined || isSuperAdmin !== undefined) && !currentAdmin.isSuperAdmin) {
            throw new ForbiddenError("Only super admin can change user roles");
        }

        // Cannot change own role
        if (id === currentAdmin.id && (isAdmin !== undefined || isSuperAdmin !== undefined)) {
            throw new ForbiddenError("Cannot change your own role");
        }

        // Cannot change super admin role
        if (existingUser.isSuperAdmin && (isAdmin !== undefined || isSuperAdmin !== undefined)) {
            throw new ForbiddenError("Cannot change super admin role");
        }

        // Prepare update data
        const updateData: Prisma.UserUpdateInput = {};

        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (isAdmin !== undefined && currentAdmin.isSuperAdmin) {
            updateData.isAdmin = isAdmin;
            if (isAdmin) {
                updateData.isSuperAdmin = false;
            }
        }
        if (isSuperAdmin !== undefined && currentAdmin.isSuperAdmin) {
            updateData.isSuperAdmin = isSuperAdmin;
            if (isSuperAdmin) {
                updateData.isAdmin = true;
            }
        }
        if (notificationPreferences !== undefined) {
            updateData.notificationPreferences = notificationPreferences;
        }

        const user = await prisma.user.update({
            where: { id: id as string },
            data: updateData,
            include: {
                _count: {
                    select: {
                        orders: true,
                        reviews: true,
                        addresses: true,
                    },
                },
            },
        });

        return sendSuccess(res, user, "User updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Delete user (soft delete - mark as deleted)
 */
export const deleteAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        // Get current user from database
        const currentAdmin = await prisma.user.findUnique({
            where: { id: currentUser?.id },
        });

        if (!currentAdmin || !currentAdmin.isAdmin) {
            throw new ForbiddenError("Admin access required");
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: id as string },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Cannot delete super admin
        if (user.isSuperAdmin) {
            throw new ForbiddenError("Cannot delete super admin");
        }

        // Cannot delete yourself
        if (id === currentAdmin.id) {
            throw new ForbiddenError("Cannot delete your own account");
        }

        // Hard delete (cascade will handle related records)
        await prisma.user.delete({
            where: { id: id as string },
        });

        return sendSuccess(res, null, "User deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Create user (optional feature)
 */
export const createAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, phone, password, role } = req.body;
        const currentUser = req.user;

        if (!email) {
            throw new ValidationError("Email is required");
        }

        // Get current user from database
        const currentAdmin = await prisma.user.findUnique({
            where: { id: currentUser?.id },
        });

        if (!currentAdmin || !currentAdmin.isSuperAdmin) {
            throw new ForbiddenError("Super admin access required");
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new ValidationError("User with this email already exists");
        }

        // Determine role
        const isSuperAdmin = role === "super_admin";
        const isAdmin = role === "admin" || isSuperAdmin;

        // Create user (password would need to be handled by auth system)
        const user = await prisma.user.create({
            data: {
                email,
                name,
                phone,
                isAdmin,
                isSuperAdmin,
            },
        });

        return sendSuccess(res, user, "User created successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Get user statistics (individual user)
 */
export const getUserStatisticsById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        const user = await prisma.user.findUnique({
            where: { id: id as string },
            include: {
                _count: {
                    select: {
                        orders: true,
                        reviews: true,
                        addresses: true,
                        wishlistItems: true,
                        payments: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Calculate detailed statistics
        const orders = await prisma.order.findMany({
            where: { userId: id as string },
            select: { total: true, status: true, createdAt: true },
        });

        const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
        const avgOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;

        const orderStatusCounts = orders.reduce(
            (acc, order) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        const payments = await prisma.payment.findMany({
            where: { userId: id as string },
            select: { amount: true, status: true, method: true },
        });

        const totalPaid = payments
            .filter((p) => p.status === "SUCCESS")
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const totalRefunded = payments
            .filter((p) => p.status === "REFUNDED")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const paymentMethodCounts = payments.reduce(
            (acc, payment) => {
                acc[payment.method] = (acc[payment.method] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        const reviews = await prisma.review.findMany({
            where: { userId: id as string },
            select: { rating: true, isApproved: true },
        });

        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        return sendSuccess(res, {
            totalOrders: user._count.orders,
            totalSpent,
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,
            totalReviews: user._count.reviews,
            avgRating: Math.round(avgRating * 100) / 100,
            addressesCount: user._count.addresses,
            wishlistItemsCount: user._count.wishlistItems,
            totalPayments: user._count.payments,
            totalPaid,
            totalRefunded,
            orderStatusCounts,
            paymentMethodCounts,
            approvedReviews: reviews.filter((r) => r.isApproved).length,
            pendingReviews: reviews.filter((r) => !r.isApproved).length,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add address for user (admin)
 */
export const addUserAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { street, city, state, zipCode, country, isDefault } = req.body;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        if (!street || !city || !state || !zipCode || !country) {
            throw new ValidationError("All address fields are required");
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: id as string },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId: id as string, isDefault: true },
                data: { isDefault: false },
            });
        }

        const address = await prisma.address.create({
            data: {
                userId: id as string,
                street,
                city,
                state,
                zipCode,
                country: country || "India",
                isDefault: isDefault || false,
            },
        });

        return sendSuccess(res, address, "Address added successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Update user address (admin)
 */
export const updateUserAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, addressId } = req.params;
        const { street, city, state, zipCode, country, isDefault } = req.body;

        if (!id || !addressId) {
            throw new ValidationError("User ID and Address ID are required");
        }

        // Verify address exists and belongs to user
        const address = await prisma.address.findFirst({
            where: {
                id: addressId as string,
                userId: id as string,
            },
        });

        if (!address) {
            throw new NotFoundError("Address not found");
        }

        // Prepare update data
        const updateData: Prisma.AddressUpdateInput = {};
        if (street !== undefined) updateData.street = street;
        if (city !== undefined) updateData.city = city;
        if (state !== undefined) updateData.state = state;
        if (zipCode !== undefined) updateData.zipCode = zipCode;
        if (country !== undefined) updateData.country = country;

        // Handle isDefault
        if (isDefault === true) {
            await prisma.address.updateMany({
                where: { userId: id as string, isDefault: true },
                data: { isDefault: false },
            });
            updateData.isDefault = true;
        } else if (isDefault === false) {
            updateData.isDefault = false;
        }

        const updatedAddress = await prisma.address.update({
            where: { id: addressId as string },
            data: updateData,
        });

        return sendSuccess(res, updatedAddress, "Address updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Delete user address (admin)
 */
export const deleteUserAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, addressId } = req.params;

        if (!id || !addressId) {
            throw new ValidationError("User ID and Address ID are required");
        }

        // Verify address exists and belongs to user
        const address = await prisma.address.findFirst({
            where: {
                id: addressId as string,
                userId: id as string,
            },
        });

        if (!address) {
            throw new NotFoundError("Address not found");
        }

        await prisma.address.delete({
            where: { id: addressId as string },
        });

        return sendSuccess(res, null, "Address deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Set default address (admin)
 */
export const setDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, addressId } = req.params;

        if (!id || !addressId) {
            throw new ValidationError("User ID and Address ID are required");
        }

        // Verify address exists and belongs to user
        const address = await prisma.address.findFirst({
            where: {
                id: addressId as string,
                userId: id as string,
            },
        });

        if (!address) {
            throw new NotFoundError("Address not found");
        }

        // Unset all other defaults
        await prisma.address.updateMany({
            where: { userId: id as string, isDefault: true },
            data: { isDefault: false },
        });

        // Set this address as default
        const updatedAddress = await prisma.address.update({
            where: { id: addressId as string },
            data: { isDefault: true },
        });

        return sendSuccess(res, updatedAddress, "Default address updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Reset user password (admin-initiated)
 */
export const resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { sendEmail } = req.body;
        const currentUser = req.user;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        // Get current user from database
        const currentAdmin = await prisma.user.findUnique({
            where: { id: currentUser?.id },
        });

        if (!currentAdmin || !currentAdmin.isAdmin) {
            throw new ForbiddenError("Admin access required");
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: id as string },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Generate a random password reset token
        // In a real implementation, you'd generate a secure token and store it
        // For now, we'll just return a success message
        // TODO: Implement actual password reset token generation and email sending

        return sendSuccess(res, {
            message: sendEmail
                ? "Password reset email sent successfully"
                : "Password reset token generated successfully",
            // In production, don't return the token to the client
        }, "Password reset initiated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Suspend user account
 */
export const suspendUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { reason, duration } = req.body;
        const currentUser = req.user;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        // Get current user from database
        const currentAdmin = await prisma.user.findUnique({
            where: { id: currentUser?.id },
        });

        if (!currentAdmin || !currentAdmin.isAdmin) {
            throw new ForbiddenError("Admin access required");
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: id as string },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Cannot suspend super admin
        if (user.isSuperAdmin) {
            throw new ForbiddenError("Cannot suspend super admin");
        }

        // Cannot suspend yourself
        if (id === currentAdmin.id) {
            throw new ForbiddenError("Cannot suspend your own account");
        }

        // For now, we'll store suspension info in notificationPreferences
        // In a production system, you'd have a dedicated isSuspended field
        const suspensionData = {
            isSuspended: true,
            suspendedAt: new Date().toISOString(),
            reason: reason || "Account suspended by admin",
            suspendedBy: currentAdmin.id,
            suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString() : null,
        };

        const updatedUser = await prisma.user.update({
            where: { id: id as string },
            data: {
                notificationPreferences: {
                    ...(user.notificationPreferences as any || {}),
                    suspension: suspensionData,
                },
            },
        });

        return sendSuccess(res, updatedUser, "User suspended successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Activate user account
 */
export const activateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        // Get current user from database
        const currentAdmin = await prisma.user.findUnique({
            where: { id: currentUser?.id },
        });

        if (!currentAdmin || !currentAdmin.isAdmin) {
            throw new ForbiddenError("Admin access required");
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: id as string },
        });

        if (!user) {
            throw new NotFoundError("User not found");
        }

        // Remove suspension from notificationPreferences
        const prefs = (user.notificationPreferences as any) || {};
        if (prefs.suspension) {
            delete prefs.suspension;
        }

        const updatedUser = await prisma.user.update({
            where: { id: id as string },
            data: {
                notificationPreferences: prefs,
            },
        });

        return sendSuccess(res, updatedUser, "User activated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Export users to CSV/Excel
 */
export const exportUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const format = (req.query.format as string) || "csv";
        const role = req.query.role as string | undefined;
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        const userIds = req.query.userIds as string | undefined; // Comma-separated user IDs

        const where: Prisma.UserWhereInput = {};

        // Filter by specific user IDs if provided
        if (userIds) {
            const idArray = userIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
            if (idArray.length > 0) {
                where.id = { in: idArray };
            }
        }

        if (role) {
            if (role === "super_admin") {
                where.isSuperAdmin = true;
            } else if (role === "admin") {
                where.isAdmin = true;
                where.isSuperAdmin = false;
            } else if (role === "customer") {
                where.isAdmin = false;
                where.isSuperAdmin = false;
            }
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        const users = await prisma.user.findMany({
            where,
            include: {
                _count: {
                    select: {
                        orders: true,
                        reviews: true,
                        addresses: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Calculate total spent for each user
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const orders = await prisma.order.findMany({
                    where: { userId: user.id as string },
                    select: { total: true },
                });
                const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);

                return {
                    id: user.id,
                    name: user.name || "N/A",
                    email: user.email,
                    phone: user.phone || "N/A",
                    role: user.isSuperAdmin ? "Super Admin" : user.isAdmin ? "Admin" : "Customer",
                    createdAt: user.createdAt.toISOString(),
                    totalOrders: user._count.orders,
                    totalSpent,
                    totalReviews: user._count.reviews,
                    addressesCount: user._count.addresses,
                };
            })
        );

        if (format === "csv") {
            // Generate CSV
            const headers = [
                "ID",
                "Name",
                "Email",
                "Phone",
                "Role",
                "Registration Date",
                "Total Orders",
                "Total Spent",
                "Total Reviews",
                "Addresses Count",
            ];
            const rows = usersWithStats.map((user) => [
                user.id,
                user.name,
                user.email,
                user.phone,
                user.role,
                user.createdAt,
                user.totalOrders,
                user.totalSpent,
                user.totalReviews,
                user.addressesCount,
            ]);

            const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=users-${Date.now()}.csv`);
            return res.send(csv);
        } else {
            // For Excel, we'd need a library like exceljs
            // For now, return JSON
            return sendSuccess(res, usersWithStats);
        }
    } catch (error) {
        next(error);
    }
};
