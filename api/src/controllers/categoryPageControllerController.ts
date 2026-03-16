import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { getParamAsString } from "../utils/db-utils.js";

// ==================== Type Definitions ====================

interface CreatePageControllerRuleData {
    specificationSlug?: string | null;
    optionValue?: string | null;
    maxPages: number;
    isActive?: boolean;
    displayOrder?: number;
}

interface UpdatePageControllerRuleData {
    specificationSlug?: string | null;
    optionValue?: string | null;
    maxPages?: number;
    isActive?: boolean;
    displayOrder?: number;
}

// ==================== Validation Utilities ====================

/**
 * Validates page controller rule data
 */
const validateRuleData = (data: CreatePageControllerRuleData | UpdatePageControllerRuleData): void => {
    if ('maxPages' in data && (data.maxPages === undefined || data.maxPages < 1)) {
        throw new ValidationError("Max pages must be at least 1");
    }

    // If specificationSlug is provided, optionValue should also be provided
    if (data.specificationSlug !== null && data.specificationSlug !== undefined) {
        if (!data.optionValue || data.optionValue.trim() === '') {
            throw new ValidationError("Option value is required when specification slug is provided");
        }
    }

    // If optionValue is provided without specificationSlug, it's invalid
    if (data.optionValue && (!data.specificationSlug || data.specificationSlug.trim() === '')) {
        throw new ValidationError("Specification slug is required when option value is provided");
    }
};

/**
 * Validates that specification and option exist for the category
 */
const validateSpecificationOption = async (
    categoryId: string,
    specificationSlug: string | null | undefined,
    optionValue: string | null | undefined
): Promise<void> => {
    if (!specificationSlug || !optionValue) {
        return; // Independent rule, no validation needed
    }

    const specification = await prisma.categorySpecification.findFirst({
        where: {
            categoryId,
            slug: specificationSlug,
        },
        include: {
            options: {
                where: {
                    value: optionValue,
                    isActive: true,
                },
            },
        },
    });

    if (!specification) {
        throw new NotFoundError(`Specification with slug "${specificationSlug}" not found for this category`);
    }

    if (specification.options.length === 0) {
        throw new NotFoundError(
            `Option value "${optionValue}" not found for specification "${specificationSlug}"`
        );
    }
};

// ==================== Admin Endpoints ====================

/**
 * Get all page controller rules for a category
 */
export const getCategoryPageControllerRules = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const rules = await prisma.categoryPageControllerRule.findMany({
            where: { categoryId },
            orderBy: [
                { displayOrder: "asc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, rules);
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single page controller rule by ID
 */
export const getCategoryPageControllerRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");

        const rule = await prisma.categoryPageControllerRule.findFirst({
            where: {
                id: ruleId,
                categoryId,
            },
        });

        if (!rule) {
            throw new NotFoundError("Page controller rule not found");
        }

        return sendSuccess(res, rule);
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new page controller rule
 */
export const createCategoryPageControllerRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const {
            specificationSlug,
            optionValue,
            maxPages,
            isActive = true,
            displayOrder = 0,
        }: CreatePageControllerRuleData = req.body;

        // Validate required fields
        if (maxPages === undefined || maxPages < 1) {
            throw new ValidationError("Max pages is required and must be at least 1");
        }

        // Validate rule data
        validateRuleData({ specificationSlug, optionValue, maxPages, isActive, displayOrder });

        // Check if category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Validate specification and option if provided
        await validateSpecificationOption(categoryId, specificationSlug, optionValue);

        // Create the rule
        const rule = await prisma.categoryPageControllerRule.create({
            data: {
                categoryId,
                specificationSlug: specificationSlug || null,
                optionValue: optionValue || null,
                maxPages,
                isActive: isActive ?? true,
                displayOrder: displayOrder ?? 0,
            },
        });

        return sendSuccess(res, rule, "Page controller rule created successfully", 201);
    } catch (error) {
        next(error);
    }
};

/**
 * Update an existing page controller rule
 */
export const updateCategoryPageControllerRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");
        const updateData: UpdatePageControllerRuleData = req.body;

        // Validate rule data
        validateRuleData(updateData);

        // Check if rule exists
        const existingRule = await prisma.categoryPageControllerRule.findFirst({
            where: {
                id: ruleId,
                categoryId,
            },
        });

        if (!existingRule) {
            throw new NotFoundError("Page controller rule not found");
        }

        // Validate specification and option if provided
        const specificationSlug = updateData.specificationSlug !== undefined 
            ? updateData.specificationSlug 
            : existingRule.specificationSlug;
        const optionValue = updateData.optionValue !== undefined 
            ? updateData.optionValue 
            : existingRule.optionValue;

        await validateSpecificationOption(categoryId, specificationSlug, optionValue);

        // Update the rule
        const rule = await prisma.categoryPageControllerRule.update({
            where: { id: ruleId },
            data: {
                ...(updateData.specificationSlug !== undefined && {
                    specificationSlug: updateData.specificationSlug || null,
                }),
                ...(updateData.optionValue !== undefined && {
                    optionValue: updateData.optionValue || null,
                }),
                ...(updateData.maxPages !== undefined && { maxPages: updateData.maxPages }),
                ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
                ...(updateData.displayOrder !== undefined && { displayOrder: updateData.displayOrder }),
            },
        });

        return sendSuccess(res, rule);
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a page controller rule
 */
export const deleteCategoryPageControllerRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");

        const rule = await prisma.categoryPageControllerRule.findFirst({
            where: {
                id: ruleId,
                categoryId,
            },
        });

        if (!rule) {
            throw new NotFoundError("Page controller rule not found");
        }

        await prisma.categoryPageControllerRule.delete({
            where: { id: ruleId },
        });

        return sendSuccess(res, { message: "Page controller rule deleted successfully" });
    } catch (error) {
        next(error);
    }
};

// ==================== Public Endpoints ====================

/**
 * Get all active page controller rules for a category (public endpoint by slug)
 */
export const getCategoryPageControllerRulesBySlug = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");

        const category = await prisma.category.findUnique({
            where: { slug },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const rules = await prisma.categoryPageControllerRule.findMany({
            where: {
                categoryId: category.id,
                isActive: true,
            },
            orderBy: [
                { displayOrder: "asc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, rules);
    } catch (error) {
        next(error);
    }
};
