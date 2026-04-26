import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { UnauthorizedError, NotFoundError, ValidationError } from "../utils/errors.js";

/** Trim + cap free-form text fields so adversarial input can't bloat
 *  the row. Returns null for empty/whitespace-only input. */
const cleanString = (value: unknown, maxLen: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, maxLen);
};

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authorized");
        }
        const { street, city, state, zipCode, country, name, phone, isDefault } = req.body;

        if (!street || !city || !state || !zipCode || !country) {
            throw new ValidationError("All address fields are required");
        }

        // Promote to default first when requested — clears the flag on any
        // sibling addresses so only the new one is marked.
        if (isDefault === true) {
            await prisma.address.updateMany({
                where: { userId: req.user.id, isDefault: true },
                data: { isDefault: false },
            });
        }

        const address = await prisma.address.create({
            data: {
                userId: req.user.id,
                name: cleanString(name, 120),
                phone: cleanString(phone, 32),
                street,
                city,
                state,
                zipCode,
                country,
                isDefault: isDefault === true,
            }
        });

        if (!address) {
            return sendError(res, "Address not created, please try again", 500);
        }

        return sendSuccess(res, address, "Address created Successfully", 200);
    } catch (error) {
        next(error);
    }
};

// Update address
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authorized");
        }

        const id = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        const { street, city, state, zipCode, country, isDefault, name, phone } = req.body;

        // Verify address exists and belongs to user
        const address = await prisma.address.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!address) {
            throw new NotFoundError("Address not found");
        }

        // Prepare update data
        const updateData: any = {};
        if (street !== undefined) updateData.street = street;
        if (city !== undefined) updateData.city = city;
        if (state !== undefined) updateData.state = state;
        if (zipCode !== undefined) updateData.zipCode = zipCode;
        if (country !== undefined) updateData.country = country;
        // Empty-string clears (caller "removed" the value); undefined keeps
        // the existing value untouched.
        if (name !== undefined) updateData.name = cleanString(name, 120);
        if (phone !== undefined) updateData.phone = cleanString(phone, 32);

        // Handle isDefault: if setting to true, set all other addresses to false
        if (isDefault === true) {
            // First, set all addresses for this user to isDefault: false
            await prisma.address.updateMany({
                where: {
                    userId: req.user.id,
                    isDefault: true,
                },
                data: {
                    isDefault: false,
                },
            });
            updateData.isDefault = true;
        } else if (isDefault === false) {
            updateData.isDefault = false;
        }

        // Update the address
        const updatedAddress = await prisma.address.update({
            where: { id },
            data: updateData,
        });

        return sendSuccess(res, updatedAddress, "Address updated successfully", 200);
    } catch (error) {
        next(error);
    }
};

// Delete address
export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            throw new UnauthorizedError("User not authorized");
        }

        const id = Array.isArray(req.params.id) 
            ? req.params.id[0] 
            : req.params.id;

        // Verify address exists and belongs to user
        const address = await prisma.address.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!address) {
            throw new NotFoundError("Address not found");
        }

        // Delete the address
        await prisma.address.delete({
            where: { id },
        });

        return sendSuccess(res, null, "Address deleted successfully", 200);
    } catch (error) {
        next(error);
    }
};
