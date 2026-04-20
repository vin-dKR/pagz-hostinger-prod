import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";

// Get product reviews
export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productId = Array.isArray(req.params.productId) 
            ? req.params.productId[0] 
            : req.params.productId;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const sortBy = (req.query.sortBy as string) || "createdAt"; // createdAt, rating, helpful
        const order = (req.query.order as string) || "desc";

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        // Additional filters
        const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
        const verifiedOnly = req.query.verified === 'true';
        const withImagesOnly = req.query.withImages === 'true';

        const where: any = {
            productId,
            isApproved: true,
        };

        if (rating) {
            where.rating = rating;
        }

        if (verifiedOnly) {
            where.isVerifiedPurchase = true;
        }

        if (withImagesOnly) {
            where.images = { isEmpty: false };
        }

        const orderBy: any = {};
        if (sortBy === "helpful") {
            orderBy.isHelpful = order === "asc" ? "asc" : "desc";
        } else if (sortBy === "rating") {
            orderBy.rating = order === "asc" ? "asc" : "desc";
        } else {
            orderBy.createdAt = order === "asc" ? "asc" : "desc";
        }

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    helpfulVotes: req.user ? {
                        where: { userId: req.user.id },
                    } : false,
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.review.count({ where }),
        ]);

        // Calculate rating distribution
        const ratingDistribution = await prisma.review.groupBy({
            by: ["rating"],
            where: {
                productId,
                isApproved: true,
            },
            _count: true,
        });

        // Calculate verified purchase percentage
        const verifiedCount = await prisma.review.count({
            where: {
                productId,
                isApproved: true,
                isVerifiedPurchase: true,
            },
        });

        const verifiedPercentage = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

        return sendSuccess(res, {
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            ratingDistribution: ratingDistribution.reduce((acc, item) => {
                acc[item.rating] = item._count;
                return acc;
            }, {} as Record<number, number>),
            verifiedPercentage,
        });
    } catch (error) {
        next(error);
    }
};

// Create review
export const createReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const productId = Array.isArray(req.params.productId) 
            ? req.params.productId[0] 
            : req.params.productId;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }
        const { rating, title, comment, images = [] } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            throw new ValidationError("Rating must be between 1 and 5");
        }

        // Verify product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        // Check if user already reviewed this product
        const existingReview = await prisma.review.findUnique({
            where: {
                productId_userId: {
                    productId,
                    userId: req.user.id,
                },
            },
        });

        if (existingReview) {
            throw new ValidationError("You have already reviewed this product");
        }

        // Check if user has purchased this product (optional verification)
        const hasPurchased = await prisma.orderItem.findFirst({
            where: {
                productId,
                order: {
                    userId: req.user.id,
                    paymentStatus: "SUCCESS",
                },
            },
        });

        const review = await prisma.review.create({
            data: {
                productId,
                userId: req.user.id,
                rating,
                title: title || null,
                comment: comment || null,
                images,
                isVerifiedPurchase: !!hasPurchased,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Note: Don't update product rating yet since review is pending approval
        // Product rating will be updated when admin approves the review

        return sendSuccess(res, review, "Review created successfully. It will be visible after admin approval.", 201);
    } catch (error) {
        next(error);
    }
};

// Update review
export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const reviewId = Array.isArray(req.params.reviewId) 
            ? req.params.reviewId[0] 
            : req.params.reviewId;

        if (!reviewId) {
            throw new ValidationError("Review ID is required");
        }
        const { rating, title, comment, images } = req.body;

        const review = await prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        if (review.userId !== req.user.id) {
            throw new UnauthorizedError("Not authorized to update this review");
        }

        const updateData: any = {};
        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                throw new ValidationError("Rating must be between 1 and 5");
            }
            updateData.rating = rating;
        }
        if (title !== undefined) updateData.title = title;
        if (comment !== undefined) updateData.comment = comment;
        if (images !== undefined) updateData.images = images;

        const updatedReview = await prisma.review.update({
            where: { id: reviewId },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Recalculate product rating (only for product-scoped reviews)
        if (review.productId) {
            const allReviews = await prisma.review.findMany({
                where: {
                    productId: review.productId,
                    isApproved: true,
                },
                select: { rating: true },
            });

            const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

            await prisma.product.update({
                where: { id: review.productId },
                data: {
                    rating: avgRating,
                },
            });
        }

        return sendSuccess(res, updatedReview, "Review updated successfully");
    } catch (error) {
        next(error);
    }
};

// Delete review
export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const reviewId = Array.isArray(req.params.reviewId) 
            ? req.params.reviewId[0] 
            : req.params.reviewId;

        const review = await prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        if (review.userId !== req.user.id) {
            throw new UnauthorizedError("Not authorized to delete this review");
        }

        await prisma.review.delete({
            where: { id: reviewId },
        });

        // Recalculate product rating (only for product-scoped reviews)
        if (review.productId) {
            const allReviews = await prisma.review.findMany({
                where: {
                    productId: review.productId,
                    isApproved: true,
                },
                select: { rating: true },
            });

            const avgRating = allReviews.length > 0
                ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
                : null;

            await prisma.product.update({
                where: { id: review.productId },
                data: {
                    rating: avgRating,
                    totalReviews: allReviews.length,
                },
            });
        }

        return sendSuccess(res, null, "Review deleted successfully");
    } catch (error) {
        next(error);
    }
};

// Vote review as helpful
export const voteReviewHelpful = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const reviewId = Array.isArray(req.params.reviewId) 
            ? req.params.reviewId[0] 
            : req.params.reviewId;

        if (!reviewId) {
            throw new ValidationError("Review ID is required");
        }
        const { isHelpful = true } = req.body;

        const review = await prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        // Check if already voted
        const existingVote = await prisma.reviewHelpfulVote.findUnique({
            where: {
                reviewId_userId: {
                    reviewId,
                    userId: req.user.id,
                },
            },
        });

        if (existingVote) {
            // Update vote
            await prisma.reviewHelpfulVote.update({
                where: { id: existingVote.id },
                data: { isHelpful },
            });
        } else {
            // Create vote
            await prisma.reviewHelpfulVote.create({
                data: {
                    reviewId,
                    userId: req.user.id,
                    isHelpful,
                },
            });
        }

        // Update helpful count
        const helpfulCount = await prisma.reviewHelpfulVote.count({
            where: {
                reviewId,
                isHelpful: true,
            },
        });

        await prisma.review.update({
            where: { id: reviewId },
            data: { isHelpful: helpfulCount },
        });

        return sendSuccess(res, { helpfulCount }, "Vote recorded successfully");
    } catch (error) {
        next(error);
    }
};

// Remove helpful vote
export const removeHelpfulVote = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const reviewId = Array.isArray(req.params.reviewId) 
            ? req.params.reviewId[0] 
            : req.params.reviewId;

        if (!reviewId) {
            throw new ValidationError("Review ID is required");
        }

        const review = await prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        // Delete vote if exists
        await prisma.reviewHelpfulVote.deleteMany({
            where: {
                reviewId,
                userId: req.user.id,
            },
        });

        // Update helpful count
        const helpfulCount = await prisma.reviewHelpfulVote.count({
            where: {
                reviewId,
                isHelpful: true,
            },
        });

        await prisma.review.update({
            where: { id: reviewId },
            data: { isHelpful: helpfulCount },
        });

        return sendSuccess(res, { helpfulCount }, "Vote removed successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/reviews:
 *   get:
 *     summary: Get all reviews
 *     description: Admin can view all product reviews for moderation with pagination and search.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for review title, comment, product name, or user email/name
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter reviews by rating
 *       - in: query
 *         name: isApproved
 *         schema:
 *           type: boolean
 *         description: Filter reviews by approval status
 *     responses:
 *       200:
 *         description: List of reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           productId:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           rating:
 *                             type: integer
 *                             minimum: 1
 *                             maximum: 5
 *                           title:
 *                             type: string
 *                             nullable: true
 *                           comment:
 *                             type: string
 *                             nullable: true
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                           isVerifiedPurchase:
 *                             type: boolean
 *                           isHelpful:
 *                             type: integer
 *                           isApproved:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           product:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get all reviews
export const getAdminReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
        const isApproved = req.query.isApproved !== undefined
            ? req.query.isApproved === 'true'
            : undefined;
        const categoryId = Array.isArray(req.query.categoryId)
            ? (req.query.categoryId[0] as string)
            : (req.query.categoryId as string | undefined);
        const skip = (page - 1) * limit;

        const where: any = {};

        if (rating) {
            where.rating = rating;
        }

        if (isApproved !== undefined) {
            where.isApproved = isApproved;
        }

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (search) {
            where.OR = [
                { title: { contains: search } },
                { comment: { contains: search } },
                {
                    product: {
                        name: { contains: search },
                    },
                },
                {
                    user: {
                        OR: [
                            { email: { contains: search } },
                            { name: { contains: search } },
                        ],
                    },
                },
            ];
        }

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    product: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.review.count({ where }),
        ]);

        return sendSuccess(res, {
            items: reviews,
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

/**
 * @openapi
 * /api/v1/admin/reviews/{id}:
 *   get:
 *     summary: Get single review by ID
 *     description: Admin can view detailed review information
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Review ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     productId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     rating:
 *                       type: integer
 *                     title:
 *                       type: string
 *                       nullable: true
 *                     comment:
 *                       type: string
 *                       nullable: true
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                     isVerifiedPurchase:
 *                       type: boolean
 *                     isHelpful:
 *                       type: integer
 *                     isApproved:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     product:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *       404:
 *         description: Review not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get single review
export const getAdminReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;

        if (!id) {
            throw new ValidationError("Review ID is required");
        }

        const review = await prisma.review.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        createdAt: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        sku: true,
                        basePrice: true,
                        images: {
                            where: { isPrimary: true },
                            select: { url: true },
                            take: 1,
                        },
                        category: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                        rating: true,
                        totalReviews: true,
                    },
                },
                helpfulVotes: {
                    take: 50, // Limit to 50 most recent votes
                    include: {
                        review: {
                            select: {
                                id: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        // Fetch user information for helpful votes
        const helpfulVotesWithUsers = await Promise.all(
            (review.helpfulVotes || []).map(async (vote) => {
                const user = await prisma.user.findUnique({
                    where: { id: vote.userId },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                });
                return {
                    ...vote,
                    user,
                };
            })
        );

        return sendSuccess(res, {
            ...review,
            helpfulVotes: helpfulVotesWithUsers,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/reviews/{id}:
 *   put:
 *     summary: Update review (approve/reject)
 *     description: Admin can approve or reject product reviews
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Review ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isApproved:
 *                 type: boolean
 *                 example: true
 *                 description: Set to true to approve, false to reject
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Review updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     isApproved:
 *                       type: boolean
 *                     product:
 *                       type: object
 *                     user:
 *                       type: object
 *       404:
 *         description: Review not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Update review (approve/reject)
export const updateAdminReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;
        const { rating, title, comment, images, isApproved, isVerifiedPurchase } = req.body;

        if (!id) {
            throw new ValidationError("Review ID is required");
        }

        const review = await prisma.review.findUnique({
            where: { id },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        const updatedReview = await prisma.review.update({
            where: { id },
            data: {
                rating: rating !== undefined ? rating : review.rating,
                title: title !== undefined ? title : review.title,
                comment: comment !== undefined ? comment : review.comment,
                images: images !== undefined ? images : review.images,
                isApproved: isApproved !== undefined ? isApproved : review.isApproved,
                isVerifiedPurchase: isVerifiedPurchase !== undefined ? isVerifiedPurchase : review.isVerifiedPurchase,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Recalculate product rating if approval status changed or rating changed
        const approvalChanged = isApproved !== undefined && isApproved !== review.isApproved;
        const ratingChanged = rating !== undefined && rating !== review.rating;
        if (approvalChanged || (ratingChanged && review.isApproved)) {
            await recalculateProductRating(review.productId);
        }

        return sendSuccess(res, updatedReview, "Review updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/reviews/{id}:
 *   delete:
 *     summary: Delete review
 *     description: Admin can delete a product review (recalculates product rating)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Review ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Review deleted successfully"
 *                 data:
 *                   type: null
 *       404:
 *         description: Review not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Delete review
export const deleteAdminReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;

        if (!id) {
            throw new ValidationError("Review ID is required");
        }

        const review = await prisma.review.findUnique({
            where: { id },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        await prisma.review.delete({
            where: { id },
        });

        // Recalculate product rating (only for product-scoped reviews)
        if (review.productId) {
            const allReviews = await prisma.review.findMany({
                where: {
                    productId: review.productId,
                    isApproved: true,
                },
                select: { rating: true },
            });

            const avgRating = allReviews.length > 0
                ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
                : null;

            await prisma.product.update({
                where: { id: review.productId },
                data: {
                    rating: avgRating,
                    totalReviews: allReviews.length,
                },
            });
        }

        return sendSuccess(res, null, "Review deleted successfully");
    } catch (error) {
        next(error);
    }
};

// Helper function to recalculate product rating
async function recalculateProductRating(productId: string | null) {
    if (!productId) {
        return { avgRating: null, totalReviews: 0 };
    }
    const allReviews = await prisma.review.findMany({
        where: {
            productId,
            isApproved: true,
        },
        select: { rating: true },
    });

    const avgRating = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : null;

    await prisma.product.update({
        where: { id: productId },
        data: {
            rating: avgRating,
            totalReviews: allReviews.length,
        },
    });

    return { avgRating, totalReviews: allReviews.length };
}

// Admin: Approve review with notification option
export const approveReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;
        const { notifyUser } = req.body;

        if (!id) {
            throw new ValidationError("Review ID is required");
        }

        const review = await prisma.review.findUnique({
            where: { id },
            include: {
                user: true,
                product: true,
            },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        if (review.isApproved) {
            return sendSuccess(res, review, "Review is already approved");
        }

        const updatedReview = await prisma.review.update({
            where: { id },
            data: { isApproved: true },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Recalculate product rating
        await recalculateProductRating(review.productId);

        // TODO: Send notification if notifyUser is true
        if (notifyUser) {
            // Implement email notification here
        }

        return sendSuccess(res, updatedReview, "Review approved successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Reject review with reason
export const rejectReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;
        const { reason, notifyUser } = req.body;

        if (!id) {
            throw new ValidationError("Review ID is required");
        }

        if (!reason || reason.trim().length === 0) {
            throw new ValidationError("Rejection reason is required");
        }

        const review = await prisma.review.findUnique({
            where: { id },
            include: {
                user: true,
                product: true,
            },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        // Delete the review (or mark as rejected, depending on business logic)
        const wasApproved = review.isApproved;

        await prisma.review.delete({
            where: { id },
        });

        // Recalculate product rating if it was previously approved
        if (wasApproved) {
            await recalculateProductRating(review.productId);
        }

        // TODO: Send notification if notifyUser is true
        if (notifyUser) {
            // Implement email notification with reason here
        }

        return sendSuccess(res, { reason }, "Review rejected successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Get review statistics
export const getReviewStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;
        const productId = req.query.productId as string;

        const where: any = {};
        if (productId) {
            where.productId = productId;
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
            if (dateTo) where.createdAt.lte = new Date(dateTo as string);
        }

        const [
            totalReviews,
            approvedReviews,
            pendingReviews,
            ratingDistribution,
            verifiedCount,
            reviewsByDate,
            mostReviewedProducts,
        ] = await Promise.all([
            prisma.review.count({ where }),
            prisma.review.count({ where: { ...where, isApproved: true } }),
            prisma.review.count({ where: { ...where, isApproved: false } }),
            prisma.review.groupBy({
                by: ["rating"],
                where: { ...where, isApproved: true },
                _count: true,
            }),
            prisma.review.count({
                where: { ...where, isApproved: true, isVerifiedPurchase: true },
            }),
            // Get reviews for date grouping (process after fetch)
            prisma.review.findMany({
                where,
                select: { createdAt: true },
                orderBy: { createdAt: "asc" },
            }).then((reviews) => {
                const dateMap = new Map<string, number>();
                reviews.forEach((review) => {
                    const dateStr: string = review.createdAt.toISOString().split("T")[0] || "";
                    if (dateStr) {
                        const currentCount = dateMap.get(dateStr) ?? 0;
                        dateMap.set(dateStr, currentCount + 1);
                    }
                });
                return Array.from(dateMap.entries()).map(([date, count]) => ({
                    date,
                    count,
                }));
            }),
            prisma.review.groupBy({
                by: ["productId"],
                where: { ...where, isApproved: true },
                _count: true,
                orderBy: { _count: { productId: "desc" } },
                take: 10,
            }),
        ]);

        // Calculate average rating
        const approvedReviewsData = await prisma.review.findMany({
            where: { ...where, isApproved: true },
            select: { rating: true },
        });

        const avgRating = approvedReviewsData.length > 0
            ? approvedReviewsData.reduce((sum, r) => sum + r.rating, 0) / approvedReviewsData.length
            : 0;

        const approvalRate = totalReviews > 0 ? (approvedReviews / totalReviews) * 100 : 0;
        const verifiedPercentage = approvedReviews > 0 ? (verifiedCount / approvedReviews) * 100 : 0;

        // reviewsByDate is already processed as array of {date, count}
        const reviewsByDateProcessed = reviewsByDate;

        // Get product names for most reviewed products
        const mostReviewedProductsWithNames = await Promise.all(
            mostReviewedProducts.map(async (item) => {
                const product = item.productId
                    ? await prisma.product.findUnique({
                        where: { id: item.productId },
                        select: { id: true, name: true },
                    })
                    : null;
                return {
                    productId: item.productId,
                    productName: product?.name || "Unknown",
                    reviewCount: item._count,
                };
            })
        );

        return sendSuccess(res, {
            totalReviews,
            approvedReviews,
            pendingReviews,
            avgRating: Math.round(avgRating * 100) / 100,
            approvalRate: Math.round(approvalRate * 100) / 100,
            verifiedPercentage: Math.round(verifiedPercentage * 100) / 100,
            ratingDistribution: ratingDistribution.reduce((acc, item) => {
                acc[item.rating] = item._count;
                return acc;
            }, {} as Record<number, number>),
            reviewsByDate: reviewsByDateProcessed,
            mostReviewedProducts: mostReviewedProductsWithNames,
        });
    } catch (error) {
        next(error);
    }
};

// Admin: Bulk approve reviews
export const bulkApproveReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reviewIds = Array.isArray(req.body.reviewIds) 
            ? req.body.reviewIds 
            : [req.body.reviewIds];

        if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
            throw new ValidationError("Review IDs array is required");
        }

        const reviews = await prisma.review.findMany({
            where: { id: { in: reviewIds } },
            select: { id: true, productId: true, isApproved: true },
        });

        if (reviews.length !== reviewIds.length) {
            throw new ValidationError("Some review IDs are invalid");
        }

        // Update all reviews to approved
        await prisma.review.updateMany({
            where: { id: { in: reviewIds } },
            data: { isApproved: true },
        });

        // Recalculate ratings for all affected products
        const productIds = [...new Set(reviews.map((r) => r.productId))];
        await Promise.all(productIds.map((pid) => recalculateProductRating(pid)));

        return sendSuccess(res, { count: reviews.length }, `Successfully approved ${reviews.length} review(s)`);
    } catch (error) {
        next(error);
    }
};

// Admin: Bulk reject reviews
export const bulkRejectReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reviewIds, reason } = req.body;

        if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
            throw new ValidationError("Review IDs array is required");
        }

        if (!reason || reason.trim().length === 0) {
            throw new ValidationError("Rejection reason is required");
        }

        const reviews = await prisma.review.findMany({
            where: { id: { in: reviewIds } },
            select: { id: true, productId: true, isApproved: true },
        });

        if (reviews.length !== reviewIds.length) {
            throw new ValidationError("Some review IDs are invalid");
        }

        // Get product IDs before deletion
        const approvedProductIds = [...new Set(
            reviews.filter((r) => r.isApproved).map((r) => r.productId)
        )];

        // Delete all reviews
        await prisma.review.deleteMany({
            where: { id: { in: reviewIds } },
        });

        // Recalculate ratings for products that had approved reviews
        await Promise.all(approvedProductIds.map((pid) => recalculateProductRating(pid)));

        return sendSuccess(res, { count: reviews.length, reason }, `Successfully rejected ${reviews.length} review(s)`);
    } catch (error) {
        next(error);
    }
};

// Admin: Bulk delete reviews
export const bulkDeleteReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reviewIds } = req.body;

        if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
            throw new ValidationError("Review IDs array is required");
        }

        const reviews = await prisma.review.findMany({
            where: { id: { in: reviewIds } },
            select: { id: true, productId: true, isApproved: true },
        });

        if (reviews.length !== reviewIds.length) {
            throw new ValidationError("Some review IDs are invalid");
        }

        // Get product IDs for approved reviews before deletion
        const approvedProductIds = [...new Set(
            reviews.filter((r) => r.isApproved).map((r) => r.productId)
        )];

        // Delete all reviews
        await prisma.review.deleteMany({
            where: { id: { in: reviewIds } },
        });

        // Recalculate ratings for products that had approved reviews
        await Promise.all(approvedProductIds.map((pid) => recalculateProductRating(pid)));

        return sendSuccess(res, { count: reviews.length }, `Successfully deleted ${reviews.length} review(s)`);
    } catch (error) {
        next(error);
    }
};

// Admin: Update review with full edit capabilities
export const editAdminReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;            
        const { rating, title, comment, images, isApproved, isVerifiedPurchase } = req.body;

        if (!id) {
            throw new ValidationError("Review ID is required");
        }

        const review = await prisma.review.findUnique({
            where: { id },
        });

        if (!review) {
            throw new NotFoundError("Review not found");
        }

        const updateData: any = {};
        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                throw new ValidationError("Rating must be between 1 and 5");
            }
            updateData.rating = rating;
        }
        if (title !== undefined) updateData.title = title;
        if (comment !== undefined) updateData.comment = comment;
        if (images !== undefined) updateData.images = images;
        if (isApproved !== undefined) updateData.isApproved = isApproved;
        if (isVerifiedPurchase !== undefined) updateData.isVerifiedPurchase = isVerifiedPurchase;

        const wasApproved = review.isApproved;
        const updatedReview = await prisma.review.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                product: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Recalculate product rating if approval status or rating changed
        if (
            (isApproved !== undefined && isApproved !== wasApproved) ||
            (rating !== undefined && rating !== review.rating) ||
            (isApproved === true && wasApproved === true)
        ) {
            await recalculateProductRating(review.productId);
        }

        return sendSuccess(res, updatedReview, "Review updated successfully");
    } catch (error) {
        next(error);
    }
};

// Get category reviews
export const getCategoryReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = Array.isArray(req.params.categoryId)
            ? req.params.categoryId[0]
            : req.params.categoryId;

        if (!categoryId) {
            throw new ValidationError("Category ID is required");
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const sortBy = (req.query.sortBy as string) || "createdAt"; // createdAt, rating, helpful
        const order = (req.query.order as string) || "desc";

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Additional filters
        const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
        const verifiedOnly = req.query.verified === 'true';
        const withImagesOnly = req.query.withImages === 'true';

        const where: any = {
            categoryId,
            isApproved: true,
        };

        if (rating) {
            where.rating = rating;
        }

        if (verifiedOnly) {
            where.isVerifiedPurchase = true;
        }

        if (withImagesOnly) {
            where.images = { isEmpty: false };
        }

        const orderBy: any = {};
        if (sortBy === "helpful") {
            orderBy.isHelpful = order === "asc" ? "asc" : "desc";
        } else if (sortBy === "rating") {
            orderBy.rating = order === "asc" ? "asc" : "desc";
        } else {
            orderBy.createdAt = order === "asc" ? "asc" : "desc";
        }

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    helpfulVotes: req.user ? {
                        where: { userId: req.user.id },
                    } : false,
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.review.count({ where }),
        ]);

        // Calculate rating distribution
        const ratingDistribution = await prisma.review.groupBy({
            by: ["rating"],
            where: {
                categoryId,
                isApproved: true,
            },
            _count: true,
        });

        // Calculate verified purchase percentage
        const verifiedCount = await prisma.review.count({
            where: {
                categoryId,
                isApproved: true,
                isVerifiedPurchase: true,
            },
        });

        const verifiedPercentage = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

        // Calculate overall rating (avg across approved reviews for this category)
        const overallAggregate = await prisma.review.aggregate({
            where: {
                categoryId,
                isApproved: true,
            },
            _avg: { rating: true },
        });

        const overallRating = total > 0 && overallAggregate._avg.rating !== null && overallAggregate._avg.rating !== undefined
            ? Math.round(overallAggregate._avg.rating * 100) / 100
            : null;

        return sendSuccess(res, {
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            ratingDistribution: ratingDistribution.reduce((acc, item) => {
                acc[item.rating] = item._count;
                return acc;
            }, {} as Record<number, number>),
            verifiedPercentage,
            overallRating,
        });
    } catch (error) {
        next(error);
    }
};

// Create category review
export const createCategoryReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const categoryId = Array.isArray(req.params.categoryId)
            ? req.params.categoryId[0]
            : req.params.categoryId;

        if (!categoryId) {
            throw new ValidationError("Category ID is required");
        }

        const { rating, title, comment, images = [], productId } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            throw new ValidationError("Rating must be between 1 and 5");
        }

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Check if user already reviewed this category
        const existingReview = await prisma.review.findUnique({
            where: {
                categoryId_userId: {
                    categoryId,
                    userId: req.user.id,
                },
            },
        });

        if (existingReview) {
            throw new ValidationError("You have already reviewed this category");
        }

        // Check if user has purchased any product in this category
        const hasPurchased = await prisma.orderItem.findFirst({
            where: {
                order: {
                    userId: req.user.id,
                    paymentStatus: "SUCCESS",
                },
                product: {
                    categoryId,
                },
            },
        });

        // Validate optional productId belongs to the category
        let validatedProductId: string | null = null;
        if (productId) {
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });
            if (product && product.categoryId === categoryId) {
                validatedProductId = productId;
            } else {
                validatedProductId = null;
            }
        }

        const review = await prisma.review.create({
            data: {
                categoryId,
                productId: validatedProductId,
                userId: req.user.id,
                rating,
                title: title || null,
                comment: comment || null,
                images: images ?? [],
                isVerifiedPurchase: !!hasPurchased,
                isApproved: false,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return sendSuccess(res, review, "Review created successfully. It will be visible after admin approval.", 201);
    } catch (error) {
        next(error);
    }
};

// Get testimonials (public, global top-rated approved reviews)
export const getTestimonials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limitParam = parseInt(req.query.limit as string);
        const limit = Math.min(
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 12,
            50,
        );

        const testimonials = await prisma.review.findMany({
            where: { isApproved: true },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: [
                { rating: "desc" },
                { isHelpful: "desc" },
                { createdAt: "desc" },
            ],
            take: limit,
        });

        return sendSuccess(res, { testimonials });
    } catch (error) {
        next(error);
    }
};

