import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { getParamAsString } from "../utils/db-utils.js";

/**
 * Public: Get active shipping methods for checkout
 */
export const getPublicShippingMethods = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const methods = await prisma.shippingMethod.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                estimatedDays: true,
                icon: true,
                iconColor: true,
                isDefault: true,
                displayOrder: true,
            },
            orderBy: [
                { displayOrder: "asc" },
                { price: "asc" },
            ],
        });

        const serialized = methods.map((method) => ({
            ...method,
            price: Number(method.price),
        }));

        return sendSuccess(res, { methods: serialized });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: List all shipping methods (with optional search/isActive filters)
 */
export const getAdminShippingMethods = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const isActiveParam = typeof req.query.isActive === "string" ? req.query.isActive : undefined;

        const where: {
            name?: { contains: string };
            isActive?: boolean;
        } = {};

        if (search) {
            where.name = { contains: search };
        }

        if (isActiveParam === "true") {
            where.isActive = true;
        } else if (isActiveParam === "false") {
            where.isActive = false;
        }

        const methods = await prisma.shippingMethod.findMany({
            where,
            orderBy: { displayOrder: "asc" },
        });

        const serialized = methods.map((method) => ({
            ...method,
            price: Number(method.price),
        }));

        return sendSuccess(res, { methods: serialized });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get single shipping method by id
 */
export const getAdminShippingMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Shipping method ID");

        const method = await prisma.shippingMethod.findUnique({
            where: { id },
        });

        if (!method) {
            throw new NotFoundError("Shipping method not found");
        }

        return sendSuccess(res, {
            ...method,
            price: Number(method.price),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Create shipping method
 */
export const createShippingMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            name,
            description,
            price,
            estimatedDays,
            icon,
            iconColor,
            isActive,
            isDefault,
            displayOrder,
        } = req.body ?? {};

        if (typeof name !== "string" || name.trim().length === 0) {
            throw new ValidationError("Name is required");
        }

        if (price === undefined || price === null || price === "") {
            throw new ValidationError("Price is required");
        }

        const priceNumber = Number(price);
        if (!Number.isFinite(priceNumber) || priceNumber < 0) {
            throw new ValidationError("Price must be a non-negative number");
        }

        let finalDisplayOrder: number;
        if (typeof displayOrder === "number" && Number.isFinite(displayOrder)) {
            finalDisplayOrder = displayOrder;
        } else {
            const maxOrder = await prisma.shippingMethod.findFirst({
                orderBy: { displayOrder: "desc" },
                select: { displayOrder: true },
            });
            finalDisplayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;
        }

        const shouldBeDefault = isDefault === true;

        const created = await prisma.$transaction(async (tx) => {
            if (shouldBeDefault) {
                await tx.shippingMethod.updateMany({
                    where: { isDefault: true },
                    data: { isDefault: false },
                });
            }

            return tx.shippingMethod.create({
                data: {
                    name: name.trim(),
                    description: description ?? null,
                    price: priceNumber,
                    estimatedDays: estimatedDays ?? null,
                    icon: icon ?? null,
                    iconColor: iconColor ?? null,
                    isActive: isActive !== undefined ? Boolean(isActive) : true,
                    isDefault: shouldBeDefault,
                    displayOrder: finalDisplayOrder,
                },
            });
        });

        return sendSuccess(
            res,
            { ...created, price: Number(created.price) },
            "Shipping method created successfully",
            201
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Update shipping method
 */
export const updateShippingMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Shipping method ID");
        const {
            name,
            description,
            price,
            estimatedDays,
            icon,
            iconColor,
            isActive,
            isDefault,
            displayOrder,
        } = req.body ?? {};

        const existing = await prisma.shippingMethod.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundError("Shipping method not found");
        }

        const updateData: {
            name?: string;
            description?: string | null;
            price?: number;
            estimatedDays?: string | null;
            icon?: string | null;
            iconColor?: string | null;
            isActive?: boolean;
            isDefault?: boolean;
            displayOrder?: number;
        } = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                throw new ValidationError("Name cannot be empty");
            }
            updateData.name = name.trim();
        }

        if (description !== undefined) {
            updateData.description = description ?? null;
        }

        if (price !== undefined) {
            const priceNumber = Number(price);
            if (!Number.isFinite(priceNumber) || priceNumber < 0) {
                throw new ValidationError("Price must be a non-negative number");
            }
            updateData.price = priceNumber;
        }

        if (estimatedDays !== undefined) updateData.estimatedDays = estimatedDays ?? null;
        if (icon !== undefined) updateData.icon = icon ?? null;
        if (iconColor !== undefined) updateData.iconColor = iconColor ?? null;
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (displayOrder !== undefined) {
            const orderNumber = Number(displayOrder);
            if (!Number.isFinite(orderNumber)) {
                throw new ValidationError("displayOrder must be a number");
            }
            updateData.displayOrder = orderNumber;
        }

        const shouldBeDefault = isDefault === true;
        if (isDefault !== undefined) {
            updateData.isDefault = Boolean(isDefault);
        }

        const updated = await prisma.$transaction(async (tx) => {
            if (shouldBeDefault) {
                await tx.shippingMethod.updateMany({
                    where: { isDefault: true, NOT: { id } },
                    data: { isDefault: false },
                });
            }

            return tx.shippingMethod.update({
                where: { id },
                data: updateData,
            });
        });

        return sendSuccess(
            res,
            { ...updated, price: Number(updated.price) },
            "Shipping method updated successfully"
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Delete shipping method. FK on orders is SET NULL so historical
 * orders retain their shippingCharges snapshot but lose the link.
 */
export const deleteShippingMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Shipping method ID");

        const existing = await prisma.shippingMethod.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundError("Shipping method not found");
        }

        await prisma.shippingMethod.delete({
            where: { id },
        });

        return sendSuccess(res, null, "Shipping method deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Reorder shipping methods. Body: { order: string[] } of ids.
 */
export const reorderShippingMethods = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { order } = req.body ?? {};

        if (!Array.isArray(order)) {
            throw new ValidationError("order must be an array of ids");
        }

        if (order.length === 0) {
            throw new ValidationError("order array cannot be empty");
        }

        if (!order.every((id: unknown) => typeof id === "string" && id.length > 0)) {
            throw new ValidationError("order must contain only non-empty string ids");
        }

        const ids = order as string[];

        const existing = await prisma.shippingMethod.findMany({
            where: { id: { in: ids } },
            select: { id: true },
        });

        if (existing.length !== ids.length) {
            throw new ValidationError("One or more shipping method ids are unknown");
        }

        await prisma.$transaction(
            ids.map((id, index) =>
                prisma.shippingMethod.update({
                    where: { id },
                    data: { displayOrder: index },
                })
            )
        );

        const updated = await prisma.shippingMethod.findMany({
            where: { id: { in: ids } },
            orderBy: { displayOrder: "asc" },
        });

        const serialized = updated.map((method) => ({
            ...method,
            price: Number(method.price),
        }));

        return sendSuccess(res, { methods: serialized }, "Shipping methods reordered successfully");
    } catch (error) {
        next(error);
    }
};
