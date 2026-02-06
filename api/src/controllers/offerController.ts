import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * Get all active offers
 * @route GET /api/v1/offers
 */
export const getOffers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();

        // Get all active offers that are currently valid
        const offers = await prisma.offer.findMany({
            where: {
                isActive: true,
                validFrom: { lte: now },
                validUntil: { gte: now },
            },
            select: {
                id: true,
                title: true,
                description: true,
                discountType: true,
                discountValue: true,
                minPurchaseAmount: true,
                maxDiscountAmount: true,
                validFrom: true,
                validUntil: true,
                bannerImage: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Convert Decimal to Number for JSON response
        const offersWithNumbers = offers.map((offer) => ({
            ...offer,
            discountValue: Number(offer.discountValue),
            minPurchaseAmount: offer.minPurchaseAmount ? Number(offer.minPurchaseAmount) : null,
            maxDiscountAmount: offer.maxDiscountAmount ? Number(offer.maxDiscountAmount) : null,
        }));

        return sendSuccess(res, offersWithNumbers);
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single offer by ID
 * @route GET /api/v1/offers/:id
 */
export const getOfferById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const offer = await prisma.offer.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                description: true,
                discountType: true,
                discountValue: true,
                minPurchaseAmount: true,
                maxDiscountAmount: true,
                validFrom: true,
                validUntil: true,
                bannerImage: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        products: true,
                    },
                },
            },
        });

        if (!offer) {
            throw new NotFoundError("Offer not found");
        }

        // Convert Decimal to Number for JSON response
        const offerWithNumbers = {
            ...offer,
            discountValue: Number(offer.discountValue),
            minPurchaseAmount: offer.minPurchaseAmount ? Number(offer.minPurchaseAmount) : null,
            maxDiscountAmount: offer.maxDiscountAmount ? Number(offer.maxDiscountAmount) : null,
        };

        return sendSuccess(res, offerWithNumbers);
    } catch (error) {
        next(error);
    }
};

/**
 * Get products for a specific offer
 * @route GET /api/v1/offers/:id/products
 */
export const getOfferProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Verify offer exists
        const offer = await prisma.offer.findUnique({
            where: { id },
            select: {
                id: true,
                discountType: true,
                discountValue: true,
                maxDiscountAmount: true,
            },
        });

        if (!offer) {
            throw new NotFoundError("Offer not found");
        }

        // Get all products linked to this offer
        const offerProducts = await prisma.offerProduct.findMany({
            where: {
                offerId: id,
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
        const productsWithDiscount = offerProducts
            .filter((op) => op.product)
            .map((op) => {
                const product = op.product!;
                const basePrice = Number(product.sellingPrice || product.basePrice);
                let discountedPrice = basePrice;

                // Calculate discount based on offer discount type
                if (offer.discountType === "PERCENTAGE") {
                    const discountAmount = (basePrice * Number(offer.discountValue)) / 100;
                    discountedPrice = basePrice - discountAmount;

                    // Apply max discount if specified
                    if (offer.maxDiscountAmount) {
                        const maxDiscount = Number(offer.maxDiscountAmount);
                        if (discountAmount > maxDiscount) {
                            discountedPrice = basePrice - maxDiscount;
                        }
                    }
                } else if (offer.discountType === "FIXED") {
                    discountedPrice = basePrice - Number(offer.discountValue);
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
