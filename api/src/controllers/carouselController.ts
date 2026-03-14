import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { getParamAsString } from "../utils/db-utils.js";

/**
 * Admin: Get all carousel items
 */
export const getAdminCarousels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const carousels = await prisma.carousel.findMany({
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: [
                { displayOrder: "asc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, carousels);
    } catch (error) {
        next(error);
    }
};

/**
 * Public: Get active carousel items
 */
export const getCarousels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const carousels = await prisma.carousel.findMany({
            where: {
                isActive: true,
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    }, 
                },
            },
            orderBy: [
                { displayOrder: "asc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, carousels);
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get single carousel item
 */
export const getAdminCarousel = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Carousel ID");

        const carousel = await prisma.carousel.findUnique({
            where: { id },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        if (!carousel) {
            throw new NotFoundError("Carousel item not found");
        }

        return sendSuccess(res, carousel);
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Create carousel item
 */
export const createCarousel = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { imageUrl, alt, categoryId, displayOrder, isActive } = req.body;

        if (!imageUrl) {
            throw new ValidationError("Image URL is required");
        }

        // Validate category if provided
        if (categoryId) {
            const category = await prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!category) {
                throw new NotFoundError("Category not found");
            }
        }

        // Get max display order if not provided
        let finalDisplayOrder = displayOrder;
        if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
            const maxOrder = await prisma.carousel.findFirst({
                orderBy: { displayOrder: "desc" },
                select: { displayOrder: true },
            });
            finalDisplayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;
        }

        const carousel = await prisma.carousel.create({
            data: {
                imageUrl,
                alt: alt || null,
                categoryId: categoryId || null,
                displayOrder: finalDisplayOrder,
                isActive: isActive !== undefined ? isActive : true,
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        return sendSuccess(res, carousel, "Carousel item created successfully", 201);
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Update carousel item
 */
export const updateCarousel = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Carousel ID");
        const { imageUrl, alt, categoryId, displayOrder, isActive } = req.body;

        const existingCarousel = await prisma.carousel.findUnique({
            where: { id },
        });

        if (!existingCarousel) {
            throw new NotFoundError("Carousel item not found");
        }

        // Validate category if provided
        if (categoryId !== undefined && categoryId !== null) {
            const category = await prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!category) {
                throw new NotFoundError("Category not found");
            }
        }

        const updateData: {
            imageUrl?: string;
            alt?: string | null;
            categoryId?: string | null;
            displayOrder?: number;
            isActive?: boolean;
        } = {};

        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (alt !== undefined) updateData.alt = alt || null;
        if (categoryId !== undefined) updateData.categoryId = categoryId || null;
        if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
        if (isActive !== undefined) updateData.isActive = isActive;

        const carousel = await prisma.carousel.update({
            where: { id },
            data: updateData,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        return sendSuccess(res, carousel, "Carousel item updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Delete carousel item
 */
export const deleteCarousel = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Carousel ID");

        const carousel = await prisma.carousel.findUnique({
            where: { id },
        });

        if (!carousel) {
            throw new NotFoundError("Carousel item not found");
        }

        await prisma.carousel.delete({
            where: { id },
        });

        return sendSuccess(res, null, "Carousel item deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Reorder carousel items
 */
export const reorderCarousels = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items)) {
            throw new ValidationError("Items must be an array");
        }

        if (items.length === 0) {
            throw new ValidationError("Items array cannot be empty");
        }

        // Validate all IDs exist
        const ids = items.map((item: { id: string }) => item.id);
        const existingCarousels = await prisma.carousel.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: { id: true },
        });

        if (existingCarousels.length !== ids.length) {
            throw new ValidationError("One or more carousel items not found");
        }

        // Update display orders
        const updatePromises = items.map((item: { id: string; displayOrder: number }, index: number) =>
            prisma.carousel.update({
                where: { id: item.id },
                data: { displayOrder: item.displayOrder ?? index },
            })
        );

        await Promise.all(updatePromises);

        // Return updated carousels
        const updatedCarousels = await prisma.carousel.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: { displayOrder: "asc" },
        });

        return sendSuccess(res, updatedCarousels, "Carousel items reordered successfully");
    } catch (error) {
        next(error);
    }
};
