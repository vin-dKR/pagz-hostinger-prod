import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";

// Validate and get coupon details
export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const { code, orderAmount, cartItems } = req.body;

        if (!code) {
            throw new ValidationError("Coupon code is required");
        }

        if (!orderAmount || orderAmount <= 0) {
            throw new ValidationError("Order amount is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { code: code.toUpperCase() },
            include: {
                offerProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                categoryId: true,
                            },
                        },
                    },
                },
            },
        });

        if (!coupon) {
            throw new NotFoundError("Invalid coupon code");
        }

        // Check if coupon is active
        if (!coupon.isActive) {
            throw new ValidationError("Coupon is not active");
        }

        // Check validity period
        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validUntil) {
            throw new ValidationError("Coupon has expired or is not yet valid");
        }

        // Check minimum purchase amount
        if (coupon.minPurchaseAmount && orderAmount < Number(coupon.minPurchaseAmount)) {
            throw new ValidationError(
                `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`
            );
        }

        // Check usage limit
        if (coupon.usageLimit !== null) {
            const usageCount = await prisma.couponUsage.count({
                where: { couponId: coupon.id },
            });
            if (usageCount >= coupon.usageLimit) {
                throw new ValidationError("Coupon usage limit reached");
            }
        }

        // Check per-user usage limit
        const userUsageCount = await prisma.couponUsage.count({
            where: {
                couponId: coupon.id,
                userId: req.user.id,
            },
        });
        if (userUsageCount >= coupon.usageLimitPerUser) {
            throw new ValidationError("You have already used this coupon");
        }

        // Validate against cart items if provided
        const eligibleItems: any[] = [];
        const ineligibleItems: any[] = [];
        let eligibleAmount = 0;

        if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
            // Get mapped product IDs and category IDs
            const mappedProductIds = await getCouponMappedProductIds(coupon.id);
            const mappedCategoryIds = await getCouponMappedCategoryIds(coupon.id);

            // Validate each cart item
            for (const item of cartItems) {
                const productId = item.productId;
                const categoryId = item.categoryId;
                const quantity = item.quantity || 1;
                const price = Number(item.price || 0);
                const productName = item.productName || "Product";
                const categoryName = item.categoryName || "Category";
                const itemTotal = price * quantity;

                let isEligible = false;
                let reason = "";

                if (coupon.applicableTo === "ALL") {
                    isEligible = true;
                } else if (coupon.applicableTo === "PRODUCT") {
                    isEligible = mappedProductIds.includes(productId);
                    if (!isEligible) {
                        reason = `Coupon not applicable to ${productName}`;
                    }
                } else if (coupon.applicableTo === "CATEGORY") {
                    // For category-based coupons, check if:
                    // 1. Product is directly linked (when categories are added, all products are linked via OfferProduct)
                    // 2. OR product's category is in the mapped categories
                    isEligible = mappedProductIds.includes(productId) || mappedCategoryIds.includes(categoryId);
                    if (!isEligible) {
                        reason = `Coupon not applicable to products in ${categoryName} category`;
                    }
                }

                if (isEligible) {
                    eligibleItems.push({
                        productId,
                        productName,
                        quantity,
                        eligibleAmount: itemTotal,
                        discount: 0, // Will be calculated below
                    });
                    eligibleAmount += itemTotal;
                } else {
                    ineligibleItems.push({
                        productId,
                        productName,
                        quantity,
                        reason,
                    });
                }
            }

            // If no eligible items, return error
            if (eligibleItems.length === 0) {
                const productNames = ineligibleItems.map((item) => item.productName).join(", ");
                throw new ValidationError(
                    `This coupon is not valid for the selected products: ${productNames}`
                );
            }
        } else {
            // No cart items provided, use orderAmount for all products
            eligibleAmount = orderAmount;
        }

        // Calculate discount only on eligible items
        let discountAmount = 0;
        if (coupon.discountType === "PERCENTAGE") {
            discountAmount = (eligibleAmount * Number(coupon.discountValue)) / 100;
        } else {
            discountAmount = Number(coupon.discountValue);
        }

        // Apply maximum discount cap
        if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
            discountAmount = Number(coupon.maxDiscountAmount);
        }

        // Ensure discount doesn't exceed eligible amount
        if (discountAmount > eligibleAmount) {
            discountAmount = eligibleAmount;
        }

        // Calculate discount per eligible item (proportional)
        if (eligibleItems.length > 0 && eligibleAmount > 0) {
            eligibleItems.forEach((item) => {
                const itemDiscount = (item.eligibleAmount / eligibleAmount) * discountAmount;
                item.discount = Math.round(itemDiscount * 100) / 100;
            });
        }

        const isFullyValid = ineligibleItems.length === 0;
        const isPartiallyValid = eligibleItems.length > 0 && ineligibleItems.length > 0;

        return sendSuccess(res, {
            coupon: {
                id: coupon.id,
                code: coupon.code,
                name: coupon.name,
                description: coupon.description,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
            },
            discountAmount,
            finalAmount: orderAmount - discountAmount,
            eligibleItems,
            ineligibleItems,
            validation: {
                isValid: eligibleItems.length > 0,
                isFullyValid,
                isPartiallyValid,
                errorMessage: isPartiallyValid
                    ? `Coupon not valid for ${ineligibleItems.length} item(s) in cart`
                    : undefined,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get available coupons (public)
export const getAvailableCoupons = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();

        const coupons = await prisma.coupon.findMany({
            where: {
                isActive: true,
                validFrom: { lte: now },
                validUntil: { gte: now },
            },
            select: {
                id: true,
                code: true,
                name: true,
                description: true,
                discountType: true,
                discountValue: true,
                minPurchaseAmount: true,
                maxDiscountAmount: true,
                validFrom: true,
                validUntil: true,
                applicableTo: true,
                usageLimit: true,
                usageLimitPerUser: true,
                _count: {
                    select: {
                        offerProducts: true,
                        usages: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Convert Decimal to Number for JSON response and add totalUses
        const couponsWithNumbers = coupons.map((coupon) => ({
            ...coupon,
            discountValue: Number(coupon.discountValue),
            minPurchaseAmount: coupon.minPurchaseAmount ? Number(coupon.minPurchaseAmount) : null,
            maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
            totalUses: coupon._count.usages,
        }));

        return sendSuccess(res, couponsWithNumbers);
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single coupon by ID (public)
 * @route GET /api/v1/coupons/:id
 */
export const getCouponById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const coupon = await prisma.coupon.findUnique({
            where: { id },
            select: {
                id: true,
                code: true,
                name: true,
                description: true,
                discountType: true,
                discountValue: true,
                minPurchaseAmount: true,
                maxDiscountAmount: true,
                validFrom: true,
                validUntil: true,
                isActive: true,
                applicableTo: true,
                usageLimit: true,
                usageLimitPerUser: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        offerProducts: true,
                        usages: true,
                    },
                },
            },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        // Convert Decimal to Number for JSON response and add totalUses
        const couponWithNumbers = {
            ...coupon,
            discountValue: Number(coupon.discountValue),
            minPurchaseAmount: coupon.minPurchaseAmount ? Number(coupon.minPurchaseAmount) : null,
            maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
            totalUses: coupon._count.usages,
        };

        return sendSuccess(res, couponWithNumbers);
    } catch (error) {
        next(error);
    }
};

/**
 * Get products for a specific coupon
 * @route GET /api/v1/coupons/:id/products
 */
export const getCouponProductsPublic = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Verify coupon exists
        const coupon = await prisma.coupon.findUnique({
            where: { id },
            select: {
                id: true,
                discountType: true,
                discountValue: true,
                maxDiscountAmount: true,
                applicableTo: true,
            },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        // Get all products linked to this coupon
        const couponProducts = await prisma.offerProduct.findMany({
            where: {
                couponId: id,
                product: {
                    isActive: true,
                },
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        shortDescription: true,
                        basePrice: true,
                        sellingPrice: true,
                        mrp: true,
                        stock: true,
                        isFeatured: true,
                        isNewArrival: true,
                        isBestSeller: true,
                        rating: true,
                        totalSold: true,
                        createdAt: true,
                        category: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                        images: {
                            where: { isPrimary: true },
                            take: 1,
                            select: {
                                id: true,
                                url: true,
                                alt: true,
                            },
                            orderBy: { displayOrder: "asc" },
                        },
                    },
                },
            },
        });

        // Filter out null products and calculate discounted prices
        const productsWithDiscount = couponProducts
            .filter((cp) => cp.product)
            .map((cp) => {
                const product = cp.product!;
                const basePrice = Number(product.sellingPrice || product.basePrice);
                let discountedPrice = basePrice;

                // Calculate discount based on coupon discount type
                if (coupon.discountType === "PERCENTAGE") {
                    const discountAmount = (basePrice * Number(coupon.discountValue)) / 100;
                    discountedPrice = basePrice - discountAmount;

                    // Apply max discount if specified
                    if (coupon.maxDiscountAmount) {
                        const maxDiscount = Number(coupon.maxDiscountAmount);
                        if (discountAmount > maxDiscount) {
                            discountedPrice = basePrice - maxDiscount;
                        }
                    }
                } else if (coupon.discountType === "FIXED") {
                    discountedPrice = basePrice - Number(coupon.discountValue);
                    if (discountedPrice < 0) {
                        discountedPrice = 0;
                    }
                }

                return {
                    ...product,
                    basePrice: Number(product.basePrice),
                    sellingPrice: Number(product.sellingPrice),
                    mrp: Number(product.mrp),
                    discountedPrice: Math.max(0, discountedPrice),
                    savings: basePrice - discountedPrice,
                };
            });

        return sendSuccess(res, productsWithDiscount);
    } catch (error) {
        next(error);
    }
};

// Get user's coupon usage history
export const getMyCoupons = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authenticated");
        }

        const couponUsages = await prisma.couponUsage.findMany({
            where: { userId: req.user.id },
            include: {
                coupon: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        discountType: true,
                        discountValue: true,
                    },
                },
            },
            orderBy: { usedAt: "desc" },
        });

        return sendSuccess(res, couponUsages);
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons:
 *   get:
 *     summary: Get all coupons
 *     description: Admin can view all coupons with usage statistics
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of coupons retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       discountType:
 *                         type: string
 *                         enum: [PERCENTAGE, FIXED]
 *                       discountValue:
 *                         type: number
 *                       minPurchaseAmount:
 *                         type: number
 *                         nullable: true
 *                       maxDiscountAmount:
 *                         type: number
 *                         nullable: true
 *                       usageLimit:
 *                         type: integer
 *                         nullable: true
 *                       usageLimitPerUser:
 *                         type: integer
 *                       validFrom:
 *                         type: string
 *                         format: date-time
 *                       validUntil:
 *                         type: string
 *                         format: date-time
 *                       isActive:
 *                         type: boolean
 *                       applicableTo:
 *                         type: string
 *                         enum: [ALL, CATEGORY, PRODUCT]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       _count:
 *                         type: object
 *                         properties:
 *                           usages:
 *                             type: integer
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get all coupons
export const getAdminCoupons = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const coupons = await prisma.coupon.findMany({
            include: {
                _count: {
                    select: {
                        usages: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return sendSuccess(res, coupons);
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/{id}:
 *   get:
 *     summary: Get single coupon by ID
 *     description: Admin can view detailed coupon information including usage history
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Coupon ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon details retrieved successfully
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
 *                     code:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     discountType:
 *                       type: string
 *                     discountValue:
 *                       type: number
 *                     minPurchaseAmount:
 *                       type: number
 *                       nullable: true
 *                     maxDiscountAmount:
 *                       type: number
 *                       nullable: true
 *                     usageLimit:
 *                       type: integer
 *                       nullable: true
 *                     usageLimitPerUser:
 *                       type: integer
 *                     validFrom:
 *                       type: string
 *                       format: date-time
 *                     validUntil:
 *                       type: string
 *                       format: date-time
 *                     isActive:
 *                       type: boolean
 *                     applicableTo:
 *                       type: string
 *                     usages:
 *                       type: array
 *                       items:
 *                         type: object
 *                     offerProducts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     _count:
 *                       type: object
 *       404:
 *         description: Coupon not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get single coupon
export const getAdminCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
            include: {
                usages: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: { usedAt: "desc" },
                },
                offerProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        usages: true,
                    },
                },
            },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        return sendSuccess(res, coupon);
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons:
 *   post:
 *     summary: Create new coupon
 *     description: Admin can create a new discount coupon
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - discountType
 *               - discountValue
 *               - validFrom
 *               - validUntil
 *             properties:
 *               code:
 *                 type: string
 *                 example: "SAVE20"
 *               name:
 *                 type: string
 *                 example: "Save 20% Off"
 *               description:
 *                 type: string
 *                 example: "Get 20% off on all products"
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *                 example: "PERCENTAGE"
 *               discountValue:
 *                 type: number
 *                 example: 20
 *               minPurchaseAmount:
 *                 type: number
 *                 nullable: true
 *                 example: 1000
 *               maxDiscountAmount:
 *                 type: number
 *                 nullable: true
 *                 example: 500
 *               usageLimit:
 *                 type: integer
 *                 nullable: true
 *                 example: 100
 *               usageLimitPerUser:
 *                 type: integer
 *                 example: 1
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-01T00:00:00Z"
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-31T23:59:59Z"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               applicableTo:
 *                 type: string
 *                 enum: [ALL, CATEGORY, PRODUCT]
 *                 example: "ALL"
 *     responses:
 *       200:
 *         description: Coupon created successfully
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
 *                   example: "Coupon created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error or coupon code already exists
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Helper function to get coupon mapped product IDs
async function getCouponMappedProductIds(couponId: string): Promise<string[]> {
    const mappings = await prisma.offerProduct.findMany({
        where: { couponId },
        select: { productId: true },
    });
    return mappings.map((m) => m.productId);
}

// Helper function to get coupon mapped category IDs (via products)
async function getCouponMappedCategoryIds(couponId: string): Promise<string[]> {
    const mappings = await prisma.offerProduct.findMany({
        where: { couponId },
        include: {
            product: {
                select: { categoryId: true },
            },
        },
    });
    const categoryIds = mappings
        .map((m) => m.product.categoryId)
        .filter((id, index, self) => self.indexOf(id) === index); // Unique
    return categoryIds;
}

// Admin: Create coupon
export const createAdminCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            code,
            name,
            description,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscountAmount,
            usageLimit,
            usageLimitPerUser,
            validFrom,
            validUntil,
            isActive,
            applicableTo,
            productIds,
            categoryIds,
        } = req.body;

        if (!code || !name || !discountType || !discountValue || !validFrom || !validUntil) {
            throw new ValidationError("Required fields: code, name, discountType, discountValue, validFrom, validUntil");
        }

        // Check if code already exists
        const existingCoupon = await prisma.coupon.findUnique({
            where: { code: code.toUpperCase() },
        });

        if (existingCoupon) {
            throw new ValidationError("Coupon code already exists");
        }

        const coupon = await prisma.coupon.create({
            data: {
                code: code.toUpperCase(),
                name,
                description,
                discountType,
                discountValue: Number(discountValue),
                minPurchaseAmount: minPurchaseAmount ? Number(minPurchaseAmount) : null,
                maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
                usageLimit: usageLimit ? Number(usageLimit) : null,
                usageLimitPerUser: usageLimitPerUser ? Number(usageLimitPerUser) : 1,
                validFrom: new Date(validFrom),
                validUntil: new Date(validUntil),
                isActive: isActive !== undefined ? isActive : true,
                applicableTo: applicableTo || "ALL",
            },
        });

        // Handle product/category mapping
        if (applicableTo === "PRODUCT" && productIds && Array.isArray(productIds) && productIds.length > 0) {
            // Verify all products exist
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true },
            });

            if (products.length !== productIds.length) {
                throw new ValidationError("Some products not found");
            }

            // Create OfferProduct entries
            await prisma.offerProduct.createMany({
                data: productIds.map((productId: string) => ({
                    couponId: coupon.id,
                    productId,
                })),
            });
        } else if (applicableTo === "CATEGORY" && categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
            // Verify all categories exist
            const categories = await prisma.category.findMany({
                where: { id: { in: categoryIds } },
                select: { id: true },
            });

            if (categories.length !== categoryIds.length) {
                throw new ValidationError("Some categories not found");
            }

            // Get all products in these categories
            const products = await prisma.product.findMany({
                where: {
                    categoryId: { in: categoryIds },
                    isActive: true,
                },
                select: { id: true },
            });

            if (products.length > 0) {
                // Create OfferProduct entries for all products in selected categories
                await prisma.offerProduct.createMany({
                    data: products.map((product) => ({
                        couponId: coupon.id,
                        productId: product.id,
                    })),
                });
            }
        }

        // Fetch coupon with mappings
        const couponWithMappings = await prisma.coupon.findUnique({
            where: { id: coupon.id },
            include: {
                offerProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                categoryId: true,
                            },
                        },
                    },
                },
            },
        });

        return sendSuccess(res, couponWithMappings, "Coupon created successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/{id}:
 *   put:
 *     summary: Update coupon
 *     description: Admin can update coupon details
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Coupon ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED]
 *               discountValue:
 *                 type: number
 *               minPurchaseAmount:
 *                 type: number
 *                 nullable: true
 *               maxDiscountAmount:
 *                 type: number
 *                 nullable: true
 *               usageLimit:
 *                 type: integer
 *                 nullable: true
 *               usageLimitPerUser:
 *                 type: integer
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *               isActive:
 *                 type: boolean
 *               applicableTo:
 *                 type: string
 *                 enum: [ALL, CATEGORY, PRODUCT]
 *     responses:
 *       200:
 *         description: Coupon updated successfully
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
 *                   example: "Coupon updated successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Coupon not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Update coupon
export const updateAdminCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscountAmount,
            usageLimit,
            usageLimitPerUser,
            validFrom,
            validUntil,
            isActive,
            applicableTo,
            productIds,
            categoryIds,
        } = req.body;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        const existingCoupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!existingCoupon) {
            throw new NotFoundError("Coupon not found");
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (discountType !== undefined) updateData.discountType = discountType;
        if (discountValue !== undefined) updateData.discountValue = Number(discountValue);
        if (minPurchaseAmount !== undefined) updateData.minPurchaseAmount = minPurchaseAmount ? Number(minPurchaseAmount) : null;
        if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount ? Number(maxDiscountAmount) : null;
        if (usageLimit !== undefined) updateData.usageLimit = usageLimit ? Number(usageLimit) : null;
        if (usageLimitPerUser !== undefined) updateData.usageLimitPerUser = Number(usageLimitPerUser);
        if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
        if (validUntil !== undefined) updateData.validUntil = new Date(validUntil);
        if (isActive !== undefined) updateData.isActive = isActive;
        if (applicableTo !== undefined) updateData.applicableTo = applicableTo;

        const coupon = await prisma.coupon.update({
            where: { id },
            data: updateData,
        });

        // Handle product/category mapping updates
        const finalApplicableTo = applicableTo !== undefined ? applicableTo : existingCoupon.applicableTo;
        const applicableToChanged = applicableTo !== undefined && applicableTo !== existingCoupon.applicableTo;

        // Only update mappings if:
        // 1. applicableTo actually changed (need to clear and potentially recreate)
        // 2. OR new productIds/categoryIds are explicitly provided (replace existing mappings)
        if (applicableToChanged || productIds !== undefined || categoryIds !== undefined) {
            // Delete existing mappings
            await prisma.offerProduct.deleteMany({
                where: { couponId: id },
            });

            // Create new mappings only if not changed to ALL
            if (finalApplicableTo !== "ALL") {
                if (finalApplicableTo === "PRODUCT" && productIds && Array.isArray(productIds) && productIds.length > 0) {
                    // Verify all products exist
                    const products = await prisma.product.findMany({
                        where: { id: { in: productIds } },
                        select: { id: true },
                    });

                    if (products.length !== productIds.length) {
                        throw new ValidationError("Some products not found");
                    }

                    // Create OfferProduct entries
                    await prisma.offerProduct.createMany({
                        data: productIds.map((productId: string) => ({
                            couponId: id,
                            productId,
                        })),
                    });
                } else if (finalApplicableTo === "CATEGORY" && categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
                    // Verify all categories exist
                    const categories = await prisma.category.findMany({
                        where: { id: { in: categoryIds } },
                        select: { id: true },
                    });

                    if (categories.length !== categoryIds.length) {
                        throw new ValidationError("Some categories not found");
                    }

                    // Get all products in these categories
                    const products = await prisma.product.findMany({
                        where: {
                            categoryId: { in: categoryIds },
                            isActive: true,
                        },
                        select: { id: true },
                    });

                    if (products.length > 0) {
                        // Create OfferProduct entries for all products in selected categories
                        await prisma.offerProduct.createMany({
                            data: products.map((product) => ({
                                couponId: id,
                                productId: product.id,
                            })),
                        });
                    }
                }
            }
        }
        // If applicableTo didn't change and no new IDs provided, existing mappings are preserved

        // Fetch coupon with mappings
        const couponWithMappings = await prisma.coupon.findUnique({
            where: { id },
            include: {
                offerProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                categoryId: true,
                            },
                        },
                    },
                },
            },
        });

        return sendSuccess(res, couponWithMappings, "Coupon updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/{id}:
 *   delete:
 *     summary: Delete coupon
 *     description: Admin can delete a coupon
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Coupon ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon deleted successfully
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
 *                   example: "Coupon deleted successfully"
 *                 data:
 *                   type: null
 *       404:
 *         description: Coupon not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Delete coupon
export const deleteAdminCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        await prisma.coupon.delete({
            where: { id },
        });

        return sendSuccess(res, null, "Coupon deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/stats:
 *   get:
 *     summary: Get coupon statistics
 *     description: Get overall coupon statistics including active count, total usage, total discount given, and expiring soon
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get coupon statistics
export const getCouponStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [
            totalActive,
            totalUsage,
            totalDiscountResult,
            expiringSoon,
        ] = await Promise.all([
            prisma.coupon.count({
                where: {
                    isActive: true,
                    validFrom: { lte: now },
                    validUntil: { gte: now },
                },
            }),
            prisma.couponUsage.count(),
            prisma.payment.aggregate({
                _sum: { discountAmount: true },
                where: { couponId: { not: null } },
            }),
            prisma.coupon.count({
                where: {
                    isActive: true,
                    validUntil: {
                        gte: now,
                        lte: sevenDaysFromNow,
                    },
                },
            }),
        ]);

        return sendSuccess(res, {
            totalActive,
            totalUsage,
            totalDiscount: Number(totalDiscountResult._sum.discountAmount || 0),
            expiringSoon,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/{id}/analytics:
 *   get:
 *     summary: Get coupon analytics
 *     description: Get detailed analytics for a specific coupon including usage stats, revenue impact, and usage over time
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Coupon ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *       404:
 *         description: Coupon not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get coupon analytics
export const getCouponAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
            include: {
                usages: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                _count: {
                    select: { usages: true },
                },
            },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        const totalDiscountResult = await prisma.payment.aggregate({
            _sum: { discountAmount: true },
            where: { couponId: id },
        });

        const uniqueUsers = new Set(coupon.usages.map((u) => u.userId)).size;
        const totalUses = coupon._count.usages;
        const totalDiscount = Number(totalDiscountResult._sum.discountAmount || 0);
        const averageDiscount = totalUses > 0 ? totalDiscount / totalUses : 0;

        // Usage over time (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const usageOverTime = await prisma.couponUsage.groupBy({
            by: ['usedAt'],
            where: {
                couponId: id,
                usedAt: {
                    gte: thirtyDaysAgo,
                },
            },
            _count: {
                id: true,
            },
            orderBy: {
                usedAt: 'asc',
            },
        });

        return sendSuccess(res, {
            totalUses,
            uniqueUsers,
            totalDiscount,
            averageDiscount,
            usageOverTime: usageOverTime.map((item) => ({
                date: item.usedAt.toISOString().split('T')[0],
                count: item._count.id,
            })),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/bulk:
 *   post:
 *     summary: Bulk coupon operations
 *     description: Perform bulk operations on coupons (activate, deactivate, delete)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - operation
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *               operation:
 *                 type: string
 *                 enum: [activate, deactivate, delete]
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Bulk coupon operations
export const bulkCouponOperation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ids, operation } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new ValidationError("Coupon IDs are required");
        }

        if (!['activate', 'deactivate', 'delete'].includes(operation)) {
            throw new ValidationError("Invalid operation. Must be 'activate', 'deactivate', or 'delete'");
        }

        let result;
        switch (operation) {
            case 'activate':
                result = await prisma.coupon.updateMany({
                    where: { id: { in: ids } },
                    data: { isActive: true },
                });
                break;
            case 'deactivate':
                result = await prisma.coupon.updateMany({
                    where: { id: { in: ids } },
                    data: { isActive: false },
                });
                break;
            case 'delete':
                result = await prisma.coupon.deleteMany({
                    where: { id: { in: ids } },
                });
                break;
            default:
                throw new ValidationError("Invalid operation");
        }

        return sendSuccess(res, {
            message: `Successfully ${operation}d ${result.count} coupon(s)`,
            count: result.count,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/coupons/{id}/usages:
 *   get:
 *     summary: Get coupon usage history
 *     description: Get paginated usage history for a specific coupon
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Coupon ID
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Items per page
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Usage history retrieved successfully
 *       404:
 *         description: Coupon not found
 *       401:
 *         description: Unauthorized - Admin authentication required
 */
// Admin: Get coupon usage history
export const getCouponUsages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        // Check if coupon exists
        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        const [usages, total] = await Promise.all([
            prisma.couponUsage.findMany({
                where: { couponId: id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { usedAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.couponUsage.count({
                where: { couponId: id },
            }),
        ]);

        // Get discount amounts from payments
        const usageWithDiscounts = await Promise.all(
            usages.map(async (usage) => {
                let discountAmount = 0;
                if (usage.orderId) {
                    const payment = await prisma.payment.findFirst({
                        where: {
                            orderId: usage.orderId,
                            couponId: id,
                        },
                        select: {
                            discountAmount: true,
                        },
                    });
                    discountAmount = payment ? Number(payment.discountAmount || 0) : 0;
                }
                return {
                    ...usage,
                    discountAmount,
                };
            })
        );

        return sendSuccess(res, {
            usages: usageWithDiscounts,
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
 * Admin: Get products for a coupon
 * GET /api/v1/admin/coupons/:id/products
 */
export const getCouponProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        const offerProducts = await prisma.offerProduct.findMany({
            where: { couponId: id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        basePrice: true,
                        sellingPrice: true,
                        category: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        });

        return sendSuccess(res, offerProducts.map((op) => ({
            id: op.id,
            product: op.product,
        })));
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Add products to a coupon
 * POST /api/v1/admin/coupons/:id/products
 */
export const addCouponProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { productIds } = req.body;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        if (!Array.isArray(productIds) || productIds.length === 0) {
            throw new ValidationError("Product IDs array is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        // Verify all products exist
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true },
        });

        if (products.length !== productIds.length) {
            throw new ValidationError("Some products not found");
        }

        // Remove existing associations for these products
        await prisma.offerProduct.deleteMany({
            where: {
                couponId: id,
                productId: { in: productIds },
            },
        });

        // Create new associations
        const created = await prisma.offerProduct.createMany({
            data: productIds.map((productId: string) => ({
                couponId: id,
                productId,
            })),
        });

        return sendSuccess(res, { count: created.count }, "Products added to coupon successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Remove products from a coupon
 * POST /api/v1/admin/coupons/:id/products/remove
 */
export const removeCouponProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { productIds } = req.body;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        if (!Array.isArray(productIds) || productIds.length === 0) {
            throw new ValidationError("Product IDs array is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        const deleted = await prisma.offerProduct.deleteMany({
            where: {
                couponId: id,
                productId: { in: productIds },
            },
        });

        return sendSuccess(res, { count: deleted.count }, "Products removed from coupon successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get categories for a coupon (via products)
 * GET /api/v1/admin/coupons/:id/categories
 */
export const getCouponCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        // Get all products mapped to this coupon
        const offerProducts = await prisma.offerProduct.findMany({
            where: { couponId: id },
            include: {
                product: {
                    select: {
                        categoryId: true,
                    },
                },
            },
        });

        // Get unique category IDs
        const categoryIds = [...new Set(offerProducts.map((op) => op.product.categoryId))];

        // Get category details with product counts
        const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: {
                id: true,
                name: true,
                slug: true,
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });

        // Count products in each category that are mapped to this coupon
        const categoriesWithCounts = await Promise.all(
            categories.map(async (category) => {
                const productCount = await prisma.offerProduct.count({
                    where: {
                        couponId: id,
                        product: {
                            categoryId: category.id,
                        },
                    },
                });

                return {
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    productCount,
                };
            })
        );

        return sendSuccess(res, categoriesWithCounts);
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Add categories to a coupon (adds all products in those categories)
 * POST /api/v1/admin/coupons/:id/categories
 */
export const addCouponCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { categoryIds } = req.body;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
            throw new ValidationError("Category IDs array is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        // Verify all categories exist
        const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true },
        });

        if (categories.length !== categoryIds.length) {
            throw new ValidationError("Some categories not found");
        }

        // Get all products in these categories
        const products = await prisma.product.findMany({
            where: {
                categoryId: { in: categoryIds },
                isActive: true,
            },
            select: { id: true },
        });

        if (products.length === 0) {
            throw new ValidationError("No active products found in selected categories");
        }

        const productIds = products.map((p) => p.id);

        // Remove existing associations for these products
        await prisma.offerProduct.deleteMany({
            where: {
                couponId: id,
                productId: { in: productIds },
            },
        });

        // Create new associations
        const created = await prisma.offerProduct.createMany({
            data: productIds.map((productId) => ({
                couponId: id,
                productId,
            })),
        });

        return sendSuccess(res, { count: created.count }, "Categories added to coupon successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Remove categories from a coupon (removes all products in those categories)
 * POST /api/v1/admin/coupons/:id/categories/remove
 */
export const removeCouponCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { categoryIds } = req.body;

        if (!id) {
            throw new ValidationError("Coupon ID is required");
        }

        if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
            throw new ValidationError("Category IDs array is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: { id },
        });

        if (!coupon) {
            throw new NotFoundError("Coupon not found");
        }

        // Get all products in these categories
        const products = await prisma.product.findMany({
            where: {
                categoryId: { in: categoryIds },
            },
            select: { id: true },
        });

        const productIds = products.map((p) => p.id);

        if (productIds.length === 0) {
            return sendSuccess(res, { count: 0 }, "No products found in selected categories");
        }

        const deleted = await prisma.offerProduct.deleteMany({
            where: {
                couponId: id,
                productId: { in: productIds },
            },
        });

        return sendSuccess(res, { count: deleted.count }, "Categories removed from coupon successfully");
    } catch (error) {
        next(error);
    }
};
