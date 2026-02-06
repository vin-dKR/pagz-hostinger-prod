import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";

// Get user's wishlist
export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [wishlistItems, total] = await Promise.all([
            prisma.wishlistItem.findMany({
                where: { userId: req.user.id },
                include: {
                    product: {
                        include: {
                            category: true,
                            images: true,
                            variants: {
                                where: { available: true },
                            },
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.wishlistItem.count({
                where: { userId: req.user.id },
            }),
        ]);

        return sendSuccess(res, {
            wishlist: wishlistItems,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Add product to wishlist
export const addToWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { productId } = req.body;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product || !product.isActive) {
            throw new NotFoundError("Product not found");
        }

        // Check if already in wishlist
        const existing = await prisma.wishlistItem.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId,
                },
            },
        });

        if (existing) {
            return sendSuccess(res, existing, "Product already in wishlist");
        }

        const wishlistItem = await prisma.wishlistItem.create({
            data: {
                userId: req.user.id,
                productId,
            },
            include: {
                product: {
                    include: {
                        category: true,
                        images: true,
                    },
                },
            },
        });

        return sendSuccess(res, wishlistItem, "Product added to wishlist successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Remove product from wishlist
export const removeFromWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { productId } = req.params;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }

        const wishlistItem = await prisma.wishlistItem.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId,
                },
            },
        });

        if (!wishlistItem) {
            throw new NotFoundError("Product not found in wishlist");
        }

        await prisma.wishlistItem.delete({
            where: { id: wishlistItem.id },
        });

        return sendSuccess(res, null, "Product removed from wishlist successfully");
    } catch (error) {
        next(error);
    }
};

// Check if product is in wishlist
export const checkWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { productId } = req.params;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }

        const wishlistItem = await prisma.wishlistItem.findUnique({
            where: {
                userId_productId: {
                    userId: req.user.id,
                    productId,
                },
            },
        });

        return sendSuccess(res, {
            isInWishlist: !!wishlistItem,
        });
    } catch (error) {
        next(error);
    }
};

