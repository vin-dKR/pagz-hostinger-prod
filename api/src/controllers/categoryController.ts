import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { Prisma } from "../../generated/prisma/client.js";
import { getParamAsString } from "../utils/db-utils.js";
import {
    validateDependencyStructure,
    validateDependency,
} from "../utils/specification-dependencies.js";
import {
    processHalfPageCalculation,
    createHalfPageBreakdownEntry,
    type HalfPageCalculationResult,
} from "../utils/half-page-calculation.js";
import { syncAllProductsForCategory, syncProductByPricingRule } from "../utils/product-sync.js";

// ==================== Category Specifications ====================

/**
 * Get all specifications for a category
 */
export const getCategorySpecifications = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const specifications = await prisma.categorySpecification.findMany({
            where: { categoryId: id },
            include: {
                options: {
                    where: { isActive: true },
                    orderBy: { displayOrder: "asc" },
                },
            },
            orderBy: { displayOrder: "asc" },
        });

        return sendSuccess(res, specifications);
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new specification for a category
 */
export const createCategorySpecification = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const { name, type, isRequired, displayOrder, dependsOn } = req.body;

        if (!name || !type) {
            throw new ValidationError("Name and type are required");
        }

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Auto-generate slug from name
        const { generateSlug } = await import("../../constants/seed-utils.js");
        const baseSlug = generateSlug(name);
        let uniqueSlug = baseSlug;
        let counter = 1;

        // Ensure slug is unique for this category
        while (await prisma.categorySpecification.findUnique({
            where: {
                categoryId_slug: {
                    categoryId: id,
                    slug: uniqueSlug,
                },
            },
        })) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Validate dependency structure
        if (!validateDependencyStructure(dependsOn)) {
            throw new ValidationError(
                "Invalid dependency structure. Expected: { specificationSlug: string, required: boolean } or null"
            );
        }

        // Validate dependency if provided
        if (dependsOn) {
            const allSpecs = await prisma.categorySpecification.findMany({
                where: { categoryId: id },
                select: {
                    id: true,
                    slug: true,
                    displayOrder: true,
                    dependsOn: true,
                },
            });

            await validateDependency(id, uniqueSlug, dependsOn, allSpecs);
        }

        // Auto-calculate display order if not provided (max + 1)
        let finalDisplayOrder = displayOrder;
        if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
            const maxOrder = await prisma.categorySpecification.findFirst({
                where: { categoryId: id },
                orderBy: { displayOrder: 'desc' },
                select: { displayOrder: true },
            });
            finalDisplayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;
        }

        const specification = await prisma.categorySpecification.create({
            data: {
                categoryId: id,
                name,
                slug: uniqueSlug,
                type,
                isRequired: isRequired ?? false,
                displayOrder: finalDisplayOrder,
                dependsOn: dependsOn ? (dependsOn as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
            include: {
                options: true,
            },
        });

        return sendSuccess(res, specification, "Specification created successfully", 201);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                return next(new ValidationError("A specification with this slug already exists"));
            }
        }
        next(error);
    }
};

/**
 * Update a specification
 */
export const updateCategorySpecification = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const specId = getParamAsString(req.params.specId, "Specification ID");
        const { name, type, isRequired, displayOrder, dependsOn } = req.body;

        const specification = await prisma.categorySpecification.findFirst({
            where: {
                id: specId,
                categoryId: id,
            },
        });

        if (!specification) {
            throw new NotFoundError("Specification not found");
        }

        // Auto-generate slug from name if name changes (ignore slug from request)
        let newSlug = specification.slug;
        if (name && name !== specification.name) {
            const { generateSlug } = await import("../../constants/seed-utils.js");
            const baseSlug = generateSlug(name);
            let uniqueSlug = baseSlug;
            let counter = 1;

            // Ensure slug is unique for this category
            while (await prisma.categorySpecification.findFirst({
                where: {
                    categoryId: id,
                    slug: uniqueSlug,
                    id: { not: specId },
                },
            })) {
                uniqueSlug = `${baseSlug}-${counter}`;
                counter++;
            }
            newSlug = uniqueSlug;
        }

        // Validate dependency structure if provided
        if (dependsOn !== undefined) {
            if (!validateDependencyStructure(dependsOn)) {
                throw new ValidationError(
                    "Invalid dependency structure. Expected: { specificationSlug: string, required: boolean } or null"
                );
            }

            // Validate dependency if provided
            if (dependsOn) {
                const allSpecs = await prisma.categorySpecification.findMany({
                    where: { categoryId: id },
                    select: {
                        id: true,
                        slug: true,
                        displayOrder: true,
                        dependsOn: true,
                    },
                });

                await validateDependency(id, newSlug, dependsOn, allSpecs, specId);
            }
        }

        const updated = await prisma.categorySpecification.update({
            where: { id: specId },
            data: {
                ...(name && { name }),
                ...(newSlug !== specification.slug && { slug: newSlug }),
                ...(type && { type }),
                ...(isRequired !== undefined && { isRequired }),
                ...(displayOrder !== undefined && { displayOrder }),
                ...(dependsOn !== undefined && { dependsOn: dependsOn ? (dependsOn as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }),
            },
            include: {
                options: true,
                category: true,
            },
        });

        // If slug changed, update all pricing rules that reference the old slug
        if (newSlug !== specification.slug) { 
            try {
                // Find all pricing rules for this category
                const pricingRules = await prisma.categoryPricingRule.findMany({
                    where: { categoryId: id },
                    select: {
                        id: true,
                        specificationValues: true,
                    },
                });

                // Update pricing rules that reference the old slug
                for (const rule of pricingRules) {
                    const specValues = rule.specificationValues as Record<string, any>;
                    
                    // Check if this rule references the old slug
                    if (specValues && specValues[specification.slug] !== undefined) {
                        // Create new specificationValues with the new slug
                        const updatedSpecValues = { ...specValues };
                        const optionValue = updatedSpecValues[specification.slug];
                        
                        // Remove old slug and add new slug with the same value
                        delete updatedSpecValues[specification.slug];
                        updatedSpecValues[newSlug] = optionValue;

                        // Update the pricing rule
                        await prisma.categoryPricingRule.update({
                            where: { id: rule.id },
                            data: {
                                specificationValues: updatedSpecValues as Prisma.InputJsonValue,
                            },
                        });
                    }
                }
            } catch (migrationError) {
                // Log but don't fail the request - pricing rules will still work with old slug
                console.error("Failed to migrate pricing rules after slug change:", migrationError);
            }
        }

        // Auto-sync published products when spec is updated
        try {
            await syncAllProductsForCategory(updated.categoryId);
        } catch (syncError) {
            // Log but don't fail the request
            console.error("Failed to auto-sync products after spec update:", syncError);
        }

        return sendSuccess(res, updated, "Specification updated successfully");
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                return next(new ValidationError("A specification with this slug already exists"));
            }
        }
        next(error);
    }
};

/**
 * Delete a specification
 */
export const deleteCategorySpecification = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const specId = getParamAsString(req.params.specId, "Specification ID");

        const specification = await prisma.categorySpecification.findFirst({
            where: {
                id: specId,
                categoryId: id,
            },
        });

        if (!specification) {
            throw new NotFoundError("Specification not found");
        }

        await prisma.categorySpecification.delete({
            where: { id: specId },
        });

        return sendSuccess(res, null, "Specification deleted successfully");
    } catch (error) {
        next(error);
    }
};

// ==================== Specification Options ====================

/**
 * Get all options for a specification
 */
export const getSpecificationOptions = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const specId = getParamAsString(req.params.specId, "Specification ID");

        const specification = await prisma.categorySpecification.findFirst({
            where: {
                id: specId,
                categoryId: id,
            },
        });

        if (!specification) {
            throw new NotFoundError("Specification not found");
        }

        const options = await prisma.categorySpecificationOption.findMany({
            where: { specificationId: specId },
            orderBy: { displayOrder: "asc" },
        });

        return sendSuccess(res, options);
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new option for a specification
 */
export const createSpecificationOption = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const specId = getParamAsString(req.params.specId, "Specification ID");
        const { label, displayOrder, isActive, metadata } = req.body;

        if (!label) {
            throw new ValidationError("Label is required");
        }

        const specification = await prisma.categorySpecification.findFirst({
            where: {
                id: specId,
                categoryId: id,
            },
        });

        if (!specification) {
            throw new NotFoundError("Specification not found");
        }

        // Auto-generate value from label (ignore value from request)
        const { generateSlug } = await import("../../constants/seed-utils.js");
        const baseValue = generateSlug(label);
        let uniqueValue = baseValue;
        let counter = 1;

        // Ensure value is unique for this specification
        while (await prisma.categorySpecificationOption.findUnique({
            where: {
                specificationId_value: {
                    specificationId: specId,
                    value: uniqueValue,
                },
            },
        })) {
            uniqueValue = `${baseValue}-${counter}`;
            counter++;
        }

        // Auto-calculate display order if not provided (max + 1)
        let finalDisplayOrder = displayOrder;
        if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
            const maxOrder = await prisma.categorySpecificationOption.findFirst({
                where: { specificationId: specId },
                orderBy: { displayOrder: 'desc' },
                select: { displayOrder: true },
            });
            finalDisplayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;
        }

        const option = await prisma.categorySpecificationOption.create({
            data: {
                specificationId: specId,
                label,
                value: uniqueValue,
                displayOrder: finalDisplayOrder,
                isActive: isActive ?? true,
                metadata: metadata ? metadata : null,
            },
        });

        return sendSuccess(res, option, "Option created successfully", 201);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                return next(new ValidationError("An option with this value already exists"));
            }
        }
        next(error);
    }
};

/**
 * Update a specification option
 */
export const updateSpecificationOption = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const specId = getParamAsString(req.params.specId, "Specification ID");
        const optionId = getParamAsString(req.params.optionId, "Option ID");
        const { label, displayOrder, isActive, metadata } = req.body;

        const option = await prisma.categorySpecificationOption.findFirst({
            where: {
                id: optionId,
                specificationId: specId,
            },
        });

        if (!option) {
            throw new NotFoundError("Option not found");
        }

        // Verify the specification belongs to the category
        const specification = await prisma.categorySpecification.findFirst({
            where: {
                id: specId,
                categoryId: id,
            },
        });

        if (!specification) {
            throw new NotFoundError("Specification not found for this category");
        }

        // Auto-generate value from label if label changes (ignore value from request)
        let newValue = option.value;
        if (label && label !== option.label) {
            const { generateSlug } = await import("../../constants/seed-utils.js");
            const baseValue = generateSlug(label);
            let uniqueValue = baseValue;
            let counter = 1;

            // Ensure value is unique for this specification
            while (await prisma.categorySpecificationOption.findFirst({
                where: {
                    specificationId: specId,
                    value: uniqueValue,
                    id: { not: optionId },
                },
            })) {
                uniqueValue = `${baseValue}-${counter}`;
                counter++;
            }
            newValue = uniqueValue;
        }

        const oldValue = option.value;

        const updated = await prisma.categorySpecificationOption.update({
            where: { id: optionId },
            data: {
                ...(label && { label }),
                ...(newValue !== option.value && { value: newValue }),
                ...(displayOrder !== undefined && { displayOrder }),
                ...(isActive !== undefined && { isActive }),
                ...(metadata !== undefined && { metadata: metadata || null }),
            },
            include: {
                specification: {
                    include: {
                        category: true,
                    },
                },
            },
        });

        // If option value changed, update all pricing rules that reference the old value
        if (newValue !== oldValue) {
            try {
                const specSlug = specification.slug;
                const categoryId = specification.categoryId;

                // Find all pricing rules for this category
                const pricingRules = await prisma.categoryPricingRule.findMany({
                    where: { categoryId },
                    select: {
                        id: true,
                        specificationValues: true,
                    },
                });

                // Update pricing rules that reference the old option value
                for (const rule of pricingRules) {
                    const specValues = rule.specificationValues as Record<string, any>;
                    
                    // Check if this rule references the specification with the old option value
                    if (specValues && specValues[specSlug] === oldValue) {
                        // Update to use the new option value
                        const updatedSpecValues = { ...specValues };
                        updatedSpecValues[specSlug] = newValue;

                        // Update the pricing rule
                        await prisma.categoryPricingRule.update({
                            where: { id: rule.id },
                            data: {
                                specificationValues: updatedSpecValues as Prisma.InputJsonValue,
                            },
                        });
                    }
                }
            } catch (migrationError) {
                // Log but don't fail the request - pricing rules will still work with old value
                console.error("Failed to migrate pricing rules after option value change:", migrationError);
            }
        }

        // Auto-sync published products when option is updated
        try {
            await syncAllProductsForCategory(updated.specification.categoryId);
        } catch (syncError) {
            // Log but don't fail the request
            console.error("Failed to auto-sync products after option update:", syncError);
        }

        return sendSuccess(res, updated, "Option updated successfully");
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                return next(new ValidationError("An option with this value already exists"));
            }
        }
        next(error);
    }
};

/**
 * Delete a specification option
 */
export const deleteSpecificationOption = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const specId = getParamAsString(req.params.specId, "Specification ID");
        const optionId = getParamAsString(req.params.optionId, "Option ID");

        const option = await prisma.categorySpecificationOption.findFirst({
            where: {
                id: optionId,
                specificationId: specId,
            },
        });

        if (!option) {
            throw new NotFoundError("Option not found");
        }

        // Verify the specification belongs to the category
        const specification = await prisma.categorySpecification.findFirst({
            where: {
                id: specId,
                categoryId: id,
            },
        });

        if (!specification) {
            throw new NotFoundError("Specification not found for this category");
        }

        await prisma.categorySpecificationOption.delete({
            where: { id: optionId },
        });

        return sendSuccess(res, null, "Option deleted successfully");
    } catch (error) {
        next(error);
    }
};

// ==================== Category Pricing Rules ====================

/**
 * Get all pricing rules for a category
 */
export const getCategoryPricingRules = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const pricingRules = await prisma.categoryPricingRule.findMany({
            where: { categoryId: id },
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, pricingRules);
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new pricing rule
 */
export const createCategoryPricingRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const {
            ruleType,
            specificationValues,
            basePrice,
            priceModifier,
            quantityMultiplier,
            fileMultiplier,
            minQuantity,
            maxQuantity,
            isActive,
            priority,
        } = req.body;

        if (!ruleType || !specificationValues) {
            throw new ValidationError("Rule type and specification values are required");
        }

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const pricingRule = await prisma.categoryPricingRule.create({
            data: {
                categoryId: id,
                ruleType,
                specificationValues,
                basePrice: basePrice ? new Prisma.Decimal(basePrice) : null,
                priceModifier: priceModifier ? new Prisma.Decimal(priceModifier) : null,
                quantityMultiplier: quantityMultiplier ?? false,
                fileMultiplier: fileMultiplier ?? false,
                minQuantity,
                maxQuantity,
                isActive: isActive ?? true,
                priority: priority ?? 0,
            },
        });

        return sendSuccess(res, pricingRule, "Pricing rule created successfully", 201);
    } catch (error) {
        next(error);
    }
};

/**
 * Update a pricing rule
 */
export const updateCategoryPricingRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");
        const {
            ruleType,
            specificationValues,
            basePrice,
            priceModifier,
            quantityMultiplier,
            fileMultiplier,
            minQuantity,
            maxQuantity,
            isActive,
            priority,
        } = req.body;

        const pricingRule = await prisma.categoryPricingRule.findFirst({
            where: {
                id: ruleId,
                categoryId: id,
            },
        });

        if (!pricingRule) {
            throw new NotFoundError("Pricing rule not found");
        }

        const updated = await prisma.categoryPricingRule.update({
            where: { id: ruleId },
            data: {
                ...(ruleType && { ruleType }),
                ...(specificationValues && { specificationValues }),
                ...(basePrice !== undefined && { basePrice: basePrice ? new Prisma.Decimal(basePrice) : null }),
                ...(priceModifier !== undefined && { priceModifier: priceModifier ? new Prisma.Decimal(priceModifier) : null }),
                ...(quantityMultiplier !== undefined && { quantityMultiplier }),
                ...(fileMultiplier !== undefined && { fileMultiplier }),
                ...(minQuantity !== undefined && { minQuantity }),
                ...(maxQuantity !== undefined && { maxQuantity }),
                ...(isActive !== undefined && { isActive }),
                ...(priority !== undefined && { priority }),
            },
        });

        // Auto-sync published product if this rule is published
        if (updated.isPublished && updated.productId) {
            try {
                await syncProductByPricingRule(ruleId);
            } catch (syncError) {
                // Log but don't fail the request
                console.error("Failed to auto-sync product after pricing rule update:", syncError);
            }
        }

        return sendSuccess(res, updated, "Pricing rule updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a pricing rule
 */
export const deleteCategoryPricingRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");

        const pricingRule = await prisma.categoryPricingRule.findFirst({
            where: {
                id: ruleId,
                categoryId: id,
            },
        });

        if (!pricingRule) {
            throw new NotFoundError("Pricing rule not found");
        }

        await prisma.categoryPricingRule.delete({
            where: { id: ruleId },
        });

        return sendSuccess(res, null, "Pricing rule deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Calculate price based on specification selections
 */
export const calculateCategoryPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const { specifications, quantity, pageCount, copies, fileCount } = req.body;

        if (!specifications || typeof specifications !== "object") {
            throw new ValidationError("Specifications object is required");
        }

        if (!quantity || quantity < 1) {
            throw new ValidationError("Quantity must be at least 1");
        }

        if (pageCount != null && (pageCount < 1 || !Number.isInteger(pageCount))) {
            throw new ValidationError("pageCount must be a positive integer");
        }
        if (copies != null && (copies < 1 || !Number.isInteger(copies))) {
            throw new ValidationError("copies must be a positive integer");
        }
        if (pageCount != null && copies != null) {
            const expectedQuantity = pageCount * copies;
            if (Math.abs(quantity - expectedQuantity) > 0.01) {
                throw new ValidationError("Quantity must equal pageCount × copies");
            }
        }

        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                pricingRules: {
                    where: { isActive: true },
                    orderBy: { priority: "desc" },
                },
                specifications: {
                    include: {
                        options: {
                            where: { isActive: true },
                        },
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Sanitize specification values against category specifications/options
        for (const [slug, value] of Object.entries(specifications)) {
            const spec = category.specifications.find((s) => s.slug === slug);
            if (!spec) {
                throw new ValidationError(`Invalid specification: ${slug}`);
            }
            if (spec.type === "SELECT" || spec.type === "MULTI_SELECT" || spec.type === "BOOLEAN") {
                const stringValue = String(value);
                const optionExists = spec.options.some((opt) => opt.value === stringValue);
                if (!optionExists) {
                    throw new ValidationError(`Invalid value for specification ${slug}`);
                }
            }
        }

        // Process half-page calculation if applicable
        const halfPageResult = processHalfPageCalculation(
            specifications,
            category.specifications.map((s) => ({
                slug: s.slug,
                options: s.options.map((o) => ({
                    value: o.value,
                    label: o.label, // Include label for display
                    metadata: o.metadata,
                })),
            })),
            pageCount,
            quantity,
            copies
        );

        // Use effective values for price calculation
        const effectivePageCount = halfPageResult.effectivePageCount;
        const effectiveQuantity = halfPageResult.effectiveQuantity;

        // Price calculation logic
        let totalPrice = 0;
        const breakdown: Array<{ label: string; value: number }> = [];
        let baseApplied = false;
        let baseQuantityMultiplierApplied = false;

        // Add half-page adjustment breakdown entry if applicable
        if (halfPageResult.hasHalfPageOption) {
            const halfPageBreakdown = createHalfPageBreakdownEntry(
                halfPageResult,
                halfPageResult.halfPageOptionLabel
            );
            if (halfPageBreakdown) {
                breakdown.push(halfPageBreakdown);
            }
        }

        // Match pricing rules based on specification values
        for (const rule of category.pricingRules) {
            const ruleSpecs = rule.specificationValues as Record<string, any>;
            let matches = true;

            // Check if all specification values in the rule match the provided specifications
            for (const [key, value] of Object.entries(ruleSpecs)) {
                if (specifications[key] !== value) {
                    matches = false;
                    break;
                }
            }

            if (!matches) continue;

            if (rule.ruleType === "BASE_PRICE" || rule.ruleType === "SPECIFICATION_COMBINATION") {
                if (baseApplied) {
                    continue;
                }
                const basePrice = rule.basePrice ? Number(rule.basePrice) : 0;
                const ruleFileMultiplier = Boolean((rule as { fileMultiplier?: boolean }).fileMultiplier);
                const safeFileCount = fileCount != null && fileCount > 0 ? Number(fileCount) : 1;
                // Priority: fileMultiplier > quantityMultiplier > flat
                const baseMultiplier = ruleFileMultiplier
                    ? safeFileCount
                    : rule.quantityMultiplier
                        ? quantity
                        : 1;
                const finalPrice = basePrice * baseMultiplier;
                totalPrice += finalPrice;
                baseApplied = true;
                baseQuantityMultiplierApplied = Boolean(rule.quantityMultiplier);
                const baseSuffix = ruleFileMultiplier && baseMultiplier > 1
                    ? ` × ${baseMultiplier} files`
                    : rule.quantityMultiplier && baseMultiplier > 1
                        ? ` × ${baseMultiplier}`
                        : "";
                breakdown.push({
                    label: `Base Price${baseSuffix}`,
                    value: finalPrice,
                });
            } else if (rule.ruleType === "ADDON") {
                const hasPageRange = rule.minQuantity != null || rule.maxQuantity != null;

                // Shared across the range check and the quantityMultiplier math
                // so the admin preview agrees with the server-side cart /
                // checkout / invoice path (which runs `computeAddonLineTotal`).
                // When half-page is selected, addon page-range must compare
                // against the reduced effective count (else ranges configured
                // for the post-Both-Sides count silently miss).
                const reducedPages =
                    effectivePageCount > 0 ? effectivePageCount : pageCount;
                const effectivePages =
                    reducedPages != null ? reducedPages * (copies != null ? copies : 1) : null;

                if (hasPageRange) {
                    if (effectivePages == null) {
                        continue;
                    }
                    const inRange =
                        (rule.minQuantity == null || effectivePages >= rule.minQuantity) &&
                        (rule.maxQuantity == null || effectivePages <= rule.maxQuantity);
                    if (!inRange) {
                        continue;
                    }
                }

                const modifier = rule.priceModifier ? Number(rule.priceModifier) : 0;
                // Match the shared util (`computeAddonLineTotal`):
                //   fileMultiplier=true      -> multiply by fileCount (min 1)
                //   quantityMultiplier=false -> flat per-order amount
                //   quantityMultiplier=true  -> multiply by effective pages
                //                               (falls back to quantity when
                //                               the line item isn't a print
                //                               job with pageCount/copies).
                const fileMultiplierOn = Boolean((rule as { fileMultiplier?: boolean }).fileMultiplier);
                const safeFileCount = fileCount != null && fileCount > 0 ? Number(fileCount) : 1;
                const multiplier = fileMultiplierOn
                    ? safeFileCount
                    : rule.quantityMultiplier
                        ? (effectivePages ?? quantity)
                        : 1;
                const finalPrice = modifier * multiplier;
                totalPrice += finalPrice;

                const rangeLabel =
                    hasPageRange
                        ? ` (${rule.minQuantity ?? 0}-${rule.maxQuantity ?? "∞"} pages`
                        : "";
                const multiplierLabel =
                    fileMultiplierOn && multiplier > 1
                        ? (rangeLabel ? `) × ${multiplier} files` : ` × ${multiplier} files`)
                        : rule.quantityMultiplier && multiplier > 1
                            ? (rangeLabel ? `) × ${multiplier}` : ` × ${multiplier}`)
                            : rangeLabel
                                ? ")"
                                : "";

                const addonSpecLabel = Object.keys(ruleSpecs).length
                    ? `: ${Object.entries(ruleSpecs)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(", ")}`
                    : "";

                breakdown.push({
                    label: `Addon${addonSpecLabel}${rangeLabel}${multiplierLabel}`,
                    value: finalPrice,
                });
            } else if (rule.ruleType === "QUANTITY_TIER") {
                if (
                    (!rule.minQuantity || quantity >= rule.minQuantity) &&
                    (!rule.maxQuantity || quantity <= rule.maxQuantity)
                ) {
                    const basePrice = rule.basePrice ? Number(rule.basePrice) : 0;
                    const finalPrice = basePrice * quantity;
                    totalPrice += finalPrice;
                    breakdown.push({
                        label: `Quantity tier (${rule.minQuantity || 0}-${rule.maxQuantity || "∞"})`,
                        value: finalPrice,
                    });
                }
            }
        }

        return sendSuccess(res, {
            totalPrice: Number(totalPrice.toFixed(2)),
            breakdown,
            quantity,
            baseQuantityMultiplierApplied,
        });
    } catch (error) {
        next(error);
    }
};

// ==================== Category Configuration ====================

/**
 * Get category configuration
 */
export const getCategoryConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");

        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                configuration: true,
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        return sendSuccess(res, category.configuration || null);
    } catch (error) {
        next(error);
    }
};

/**
 * Create or update category configuration
 */
export const upsertCategoryConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const {
            pageTitle,
            pageDescription,
            features,
            breadcrumbConfig,
            layoutConfig,
            fileUploadRequired,
            fileUploadConfig,
        } = req.body;

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const configuration = await prisma.categoryConfiguration.upsert({
            where: { categoryId: id },
            create: {
                categoryId: id,
                pageTitle,
                pageDescription,
                features: features ? features : null,
                breadcrumbConfig: breadcrumbConfig ? breadcrumbConfig : null,
                layoutConfig: layoutConfig ? layoutConfig : null,
                fileUploadRequired: fileUploadRequired ?? false,
                fileUploadConfig: fileUploadConfig ? fileUploadConfig : null,
            },
            update: {
                ...(pageTitle !== undefined && { pageTitle }),
                ...(pageDescription !== undefined && { pageDescription }),
                ...(features !== undefined && { features: features || null }),
                ...(breadcrumbConfig !== undefined && { breadcrumbConfig: breadcrumbConfig || null }),
                ...(layoutConfig !== undefined && { layoutConfig: layoutConfig || null }),
                ...(fileUploadRequired !== undefined && { fileUploadRequired }),
                ...(fileUploadConfig !== undefined && { fileUploadConfig: fileUploadConfig || null }),
            },
        });

        return sendSuccess(res, configuration, "Configuration saved successfully");
    } catch (error) {
        next(error);
    }
};

// ==================== Admin API Endpoints ====================

/**
 * Search categories by name for admin panel (e.g., parent category selector)
 * Returns matching categories with basic info, excluding specified category ID
 */
export const searchCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const query = (req.query.q as string) || "";
        const excludeId = (req.query.excludeId as string) || "";
        const limit = parseInt((req.query.limit as string) || "10", 10);

        if (!query || query.trim().length === 0) {
            return sendSuccess(res, []);
        }

        const where: Prisma.CategoryWhereInput = {
            name: {
                contains: query.trim(),
            },
        };

        // Exclude specified category ID (to prevent selecting self as parent)
        if (excludeId) {
            where.id = {
                not: excludeId,
            };
        }

        const categories = await prisma.category.findMany({
            where,
            select: {
                id: true,
                name: true,
                slug: true,
                parentId: true,
            },
            take: limit,
            orderBy: [
                { name: "asc" },
            ],
        });

        return sendSuccess(res, categories);
    } catch (error) {
        next(error);
    }
};

// ==================== Public API Endpoints ====================

/**
 * Get category by slug with all specifications, options, pricing rules, and configuration
 * Handles parent-child hierarchy:
 * - If category has children: Returns category with children array (for subcategory grid)
 * - If category has no children: Returns category with full specifications, pricing rules, etc.
 * - Includes parent info if category is a child
 */
export const getCategoryBySlug = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");
        const { DEFAULT_CATEGORY_ORDER_BY } = await import("../utils/category-ordering.js");

        // First, get category with children count to determine if it's a parent
        const categoryWithCount = await prisma.category.findUnique({
            where: {
                slug,
                isActive: true,
            },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                _count: {
                    select: {
                        children: true,
                    },
                },
            },
        });

        if (!categoryWithCount) {
            throw new NotFoundError("Category not found");
        }

        const hasChildren = categoryWithCount._count.children > 0;

        // If category has children, return parent category with children array
        if (hasChildren) {
            const parentCategory = await prisma.category.findUnique({
                where: {
                    slug,
                    isActive: true,
                },
                include: {
                    parent: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    children: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            description: true,
                            image: true,
                            priority: true,
                            images: {
                                where: { isPrimary: true },
                                take: 1,
                                select: {
                                    url: true,
                                    alt: true,
                                },
                                orderBy: { displayOrder: "asc" },
                            },
                        },
                        orderBy: DEFAULT_CATEGORY_ORDER_BY,
                    },
                    images: {
                        orderBy: [
                            { displayOrder: "asc" },
                            { createdAt: "asc" },
                        ],
                    },
                },
            });

            if (!parentCategory) {
                throw new NotFoundError("Category not found");
            }

            // Transform response to include helper fields
            const transformed = {
                ...parentCategory,
                childrenCount: parentCategory.children.length,
                hasChildren: true,
            };

            return sendSuccess(res, transformed);
        }

        // If category has no children, return full category data with specifications, pricing, etc.
        const category = await prisma.category.findUnique({
            where: {
                slug,
                isActive: true,
            },
            include: {
                parent: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                specifications: {
                    where: {
                        options: {
                            some: {
                                isActive: true,
                            },
                        },
                    },
                    include: {
                        options: {
                            where: { isActive: true },
                            orderBy: { displayOrder: "asc" },
                        },
                    },
                    orderBy: { displayOrder: "asc" },
                },
                pricingRules: {
                    where: { isActive: true },
                    orderBy: [
                        { priority: "desc" },
                        { createdAt: "asc" },
                    ],
                },
                configuration: true,
                images: {
                    orderBy: [
                        { displayOrder: "asc" },
                        { createdAt: "asc" },
                    ],
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Transform response to include helper fields
        const transformed = {
            ...category,
            childrenCount: 0,
            hasChildren: false,
            children: [], // Empty array for consistency
        };

        return sendSuccess(res, transformed);
    } catch (error) {
        next(error);
    }
};

/**
 * Get ADDON pricing rules for a category (public)
 */
export const getCategoryAddonsPublic = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");

        const category = await prisma.category.findUnique({
            where: {
                slug,
                isActive: true,
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const addons = await prisma.categoryPricingRule.findMany({
            where: {
                categoryId: category.id,
                isActive: true,
                ruleType: "ADDON",
            },
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, addons);
    } catch (error) {
        next(error);
    }
};

/**
 * Calculate price for a category based on specification selections (public endpoint)
 */
export const calculateCategoryPricePublic = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");
        const { specifications, quantity, pageCount, copies, fileCount } = req.body;

        if (!specifications || typeof specifications !== "object") {
            throw new ValidationError("Specifications object is required");
        }

        if (!quantity || quantity < 1) {
            throw new ValidationError("Quantity must be at least 1");
        }

        if (pageCount != null && (pageCount < 1 || !Number.isInteger(pageCount))) {
            throw new ValidationError("pageCount must be a positive integer");
        }
        if (copies != null && (copies < 1 || !Number.isInteger(copies))) {
            throw new ValidationError("copies must be a positive integer");
        }
        if (pageCount != null && copies != null) {
            const expectedQuantity = pageCount * copies;
            if (Math.abs(quantity - expectedQuantity) > 0.01) {
                throw new ValidationError("Quantity must equal pageCount × copies");
            }
        }

        const category = await prisma.category.findUnique({
            where: {
                slug,
                isActive: true,
            },
            include: {
                pricingRules: {
                    where: { isActive: true },
                    orderBy: { priority: "desc" },
                },
                specifications: {
                    include: {
                        options: {
                            where: { isActive: true },
                        },
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Sanitize specification values against category specifications/options
        for (const [slugKey, value] of Object.entries(specifications)) {
            const spec = category.specifications.find((s) => s.slug === slugKey);
            if (!spec) {
                throw new ValidationError(`Invalid specification: ${slugKey}`);
            }
            if (spec.type === "SELECT" || spec.type === "MULTI_SELECT" || spec.type === "BOOLEAN") {
                const stringValue = String(value);
                const optionExists = spec.options.some((opt) => opt.value === stringValue);
                if (!optionExists) {
                    throw new ValidationError(`Invalid value for specification ${slugKey}`);
                }
            }
        }

        // Process half-page calculation if applicable
        const halfPageResult = processHalfPageCalculation(
            specifications,
            category.specifications.map((s) => ({
                slug: s.slug,
                options: s.options.map((o) => ({
                    value: o.value,
                    label: o.label, // Include label for display
                    metadata: o.metadata,
                })),
            })),
            pageCount,
            quantity,
            copies
        );

        // Use effective values for price calculation
        const effectivePageCount = halfPageResult.effectivePageCount;
        const effectiveQuantity = halfPageResult.effectiveQuantity;

        // Price calculation logic
        let totalPrice = 0;
        const breakdown: Array<{ label: string; value: number }> = [];
        let baseApplied = false;
        let baseQuantityMultiplierApplied = false;

        // Add half-page adjustment breakdown entry if applicable
        if (halfPageResult.hasHalfPageOption) {
            const halfPageBreakdown = createHalfPageBreakdownEntry(
                halfPageResult,
                halfPageResult.halfPageOptionLabel
            );
            if (halfPageBreakdown) {
                breakdown.push(halfPageBreakdown);
            }
        }

        // Match pricing rules based on specification values
        for (const rule of category.pricingRules) {
            const ruleSpecs = rule.specificationValues as Record<string, any>;
            let matches = true;

            // Check if all specification values in the rule match the provided specifications
            for (const [key, value] of Object.entries(ruleSpecs)) {
                if (specifications[key] !== value) {
                    matches = false;
                    break;
                }
            }

            if (!matches) continue;

            if (rule.ruleType === "BASE_PRICE" || rule.ruleType === "SPECIFICATION_COMBINATION") {
                if (baseApplied) {
                    continue;
                }
                const basePrice = rule.basePrice ? Number(rule.basePrice) : 0;
                const ruleFileMultiplier = Boolean((rule as { fileMultiplier?: boolean }).fileMultiplier);
                const safeFileCount = fileCount != null && fileCount > 0 ? Number(fileCount) : 1;
                // Priority: fileMultiplier > quantityMultiplier > flat
                const baseMultiplier = ruleFileMultiplier
                    ? safeFileCount
                    : rule.quantityMultiplier
                        ? effectiveQuantity
                        : 1;
                const finalPrice = basePrice * baseMultiplier;
                totalPrice += finalPrice;
                baseApplied = true;
                baseQuantityMultiplierApplied = Boolean(rule.quantityMultiplier);
                const baseSuffix = ruleFileMultiplier && baseMultiplier > 1
                    ? ` (${baseMultiplier} files)`
                    : effectivePageCount > 0
                        ? ` (${effectivePageCount} pages × ${copies || 1} copies)`
                        : "";
                breakdown.push({
                    label: `Base Price${baseSuffix}`,
                    value: finalPrice,
                });
            } else if (rule.ruleType === "ADDON") {
                const hasPageRange = rule.minQuantity != null || rule.maxQuantity != null;

                // effectivePages = pageCount * copies when a print-job with
                // pages is being priced; null otherwise. Shared with the range
                // check AND the quantityMultiplier math below so the preview
                // agrees with the server-side cart / checkout / invoice path
                // (which calls `computeAddonLineTotal` with the same input).
                const effectivePages =
                    effectivePageCount > 0 ? effectivePageCount * (copies != null ? copies : 1) : null;

                if (hasPageRange) {
                    if (effectivePages == null) {
                        continue;
                    }
                    const inRange =
                        (rule.minQuantity == null || effectivePages >= rule.minQuantity) &&
                        (rule.maxQuantity == null || effectivePages <= rule.maxQuantity);
                    if (!inRange) {
                        continue;
                    }
                }

                const modifier = rule.priceModifier ? Number(rule.priceModifier) : 0;
                // Match the shared util (`computeAddonLineTotal`):
                //   fileMultiplier=true      -> multiply by fileCount (min 1)
                //   quantityMultiplier=false -> flat per-order amount
                //   quantityMultiplier=true  -> multiply by effective pages
                //                               (falls back to quantity when
                //                               the line item isn't a print
                //                               job with pageCount/copies).
                const fileMultiplierOn = Boolean((rule as { fileMultiplier?: boolean }).fileMultiplier);
                const safeFileCount = fileCount != null && fileCount > 0 ? Number(fileCount) : 1;
                const multiplier = fileMultiplierOn
                    ? safeFileCount
                    : rule.quantityMultiplier
                        ? (effectivePages ?? effectiveQuantity)
                        : 1;
                const finalPrice = modifier * multiplier;
                totalPrice += finalPrice;

                const rangeLabel =
                    hasPageRange
                        ? ` (${rule.minQuantity ?? 0}-${rule.maxQuantity ?? "∞"} pages`
                        : "";
                const multiplierLabel =
                    fileMultiplierOn && multiplier > 1
                        ? (rangeLabel ? `) × ${multiplier} files` : ` × ${multiplier} files`)
                        : rule.quantityMultiplier && multiplier > 1
                            ? (rangeLabel ? `) × ${multiplier}` : ` × ${multiplier}`)
                            : rangeLabel
                                ? ")"
                                : "";

                const addonSpecLabel = Object.keys(ruleSpecs).length
                    ? `: ${Object.entries(ruleSpecs)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(", ")}`
                    : "";

                breakdown.push({
                    label: `Addon${addonSpecLabel}${rangeLabel}${multiplierLabel}`,
                    value: finalPrice,
                });
            } else if (rule.ruleType === "QUANTITY_TIER") {
                if (
                    (!rule.minQuantity || effectiveQuantity >= rule.minQuantity) &&
                    (!rule.maxQuantity || effectiveQuantity <= rule.maxQuantity)
                ) {
                    const basePrice = rule.basePrice ? Number(rule.basePrice) : 0;
                    const finalPrice = basePrice * effectiveQuantity;
                    totalPrice += finalPrice;
                    breakdown.push({
                        label: `Quantity tier (${rule.minQuantity || 0}-${rule.maxQuantity || "∞"})`,
                        value: finalPrice,
                    });
                }
            }
        }

        return sendSuccess(res, {
            totalPrice: Number(totalPrice.toFixed(2)),
            breakdown,
            quantity: effectiveQuantity,
            originalQuantity: quantity,
            effectivePageCount: effectivePageCount > 0 ? effectivePageCount : undefined,
            originalPageCount: pageCount || undefined,
            hasHalfPageAdjustment: halfPageResult.hasHalfPageOption,
            baseQuantityMultiplierApplied,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Find products by category and specification combination
 */
export const getProductsBySpecifications = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");
        const { specifications } = req.query;

        if (!specifications) {
            return sendSuccess(res, []);
        }

        let specValues: Record<string, any>;
        try {
            specValues = typeof specifications === "string" ? JSON.parse(specifications) : specifications;
        } catch {
            throw new ValidationError("Invalid specifications format");
        }

        const category = await prisma.category.findUnique({
            where: {
                slug,
                isActive: true,
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Find pricing rules that match the specification combination
        const matchingRules = await prisma.categoryPricingRule.findMany({
            where: {
                categoryId: category.id,
                isPublished: true,
                isActive: true,
            },
            include: {
                product: {
                    include: {
                        images: {
                            where: { isPrimary: true },
                            take: 1,
                        },
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

        // Filter rules that match the specification values
        const matchedProducts = matchingRules
            .filter((rule) => {
                const ruleSpecs = rule.specificationValues as Record<string, any>;
                // Check if all specification values in the rule match the provided specifications
                for (const [key, value] of Object.entries(ruleSpecs)) {
                    if (specValues[key] !== value) {
                        return false;
                    }
                }
                // Also check that all provided specs are in the rule (exact match)
                for (const [key, value] of Object.entries(specValues)) {
                    if (ruleSpecs[key] !== value) {
                        return false;
                    }
                }
                return true;
            })
            .map((rule) => rule.product)
            .filter((product) => product !== null);

        return sendSuccess(res, matchedProducts);
    } catch (error) {
        next(error);
    }
};

// ==================== Category Images ====================

/**
 * Get all images for a category
 */
export const getCategoryImages = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const images = await prisma.categoryImage.findMany({
            where: { categoryId: id },
            orderBy: [
                { displayOrder: "asc" },
                { createdAt: "asc" },
            ],
        });

        return sendSuccess(res, images);
    } catch (error) {
        next(error);
    }
};

/**
 * Upload/create a new category image
 */
export const createCategoryImage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const { url, alt, isPrimary, displayOrder } = req.body;

        if (!url) {
            throw new ValidationError("Image URL is required");
        }

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // If setting as primary, unset other primary images
        if (isPrimary) {
            await prisma.categoryImage.updateMany({
                where: { categoryId: id, isPrimary: true },
                data: { isPrimary: false },
            });
        }

        // Get max display order if not provided
        let order = displayOrder;
        if (order === undefined || order === null) {
            const maxOrder = await prisma.categoryImage.findFirst({
                where: { categoryId: id },
                orderBy: { displayOrder: "desc" },
                select: { displayOrder: true },
            });
            order = maxOrder ? maxOrder.displayOrder + 1 : 0;
        }

        const image = await prisma.categoryImage.create({
            data: {
                categoryId: id,
                url,
                alt: alt || null,
                isPrimary: isPrimary || false,
                displayOrder: order,
            },
        });

        return sendSuccess(res, image, "Image added successfully", 201);
    } catch (error) {
        next(error);
    }
};

/**
 * Update a category image
 */
export const updateCategoryImage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const imageId = getParamAsString(req.params.imageId, "Image ID");
        const { url, alt, isPrimary, displayOrder } = req.body;

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const image = await prisma.categoryImage.findFirst({
            where: { id: imageId, categoryId: id },
        });

        if (!image) {
            throw new NotFoundError("Image not found");
        }

        // If setting as primary, unset other primary images
        if (isPrimary && !image.isPrimary) {
            await prisma.categoryImage.updateMany({
                where: { categoryId: id, isPrimary: true },
                data: { isPrimary: false },
            });
        }

        const updatedImage = await prisma.categoryImage.update({
            where: { id: imageId },
            data: {
                ...(url !== undefined && { url }),
                ...(alt !== undefined && { alt }),
                ...(isPrimary !== undefined && { isPrimary }),
                ...(displayOrder !== undefined && { displayOrder }),
            },
        });

        return sendSuccess(res, updatedImage, "Image updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a category image
 */
export const deleteCategoryImage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const id = getParamAsString(req.params.id, "Category ID");
        const imageId = getParamAsString(req.params.imageId, "Image ID");

        const category = await prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const image = await prisma.categoryImage.findFirst({
            where: { id: imageId, categoryId: id },
        });

        if (!image) {
            throw new NotFoundError("Image not found");
        }

        await prisma.categoryImage.delete({
            where: { id: imageId },
        });

        return sendSuccess(res, null, "Image deleted successfully");
    } catch (error) {
        next(error);
    }
};

// ==================== Publish Pricing Rule as Product ====================

/**
 * Preview product data from a pricing rule (before publishing)
 */
export const previewProductFromPricingRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            include: {
                pricingRules: {
                    where: { id: ruleId },
                },
                configuration: true,
                specifications: {
                    include: {
                        options: true,
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const rule = category.pricingRules[0];
        if (!rule) {
            throw new NotFoundError("Pricing rule not found");
        }

        // Generate product name from specification values
        const specValues = rule.specificationValues as Record<string, any>;
        const specParts: string[] = [];

        for (const spec of category.specifications) {
            const value = specValues[spec.slug];
            if (value) {
                const option = spec.options.find((opt) => opt.value === value);
                if (option) {
                    specParts.push(option.label);
                } else {
                    specParts.push(String(value));
                }
            }
        }

        const productName = specParts.length > 0
            ? `${category.name} - ${specParts.join(" ")}`
            : category.name;

        // Generate slug
        const baseSlug = productName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        let uniqueSlug = baseSlug;
        let counter = 1;
        while (await prisma.product.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Convert specification values to ProductSpecification format
        const specifications = category.specifications
            .filter((spec) => specValues[spec.slug])
            .map((spec, index) => {
                const value = specValues[spec.slug];
                const option = spec.options.find((opt) => opt.value === value);
                return {
                    key: spec.name,
                    value: option ? option.label : String(value),
                    displayOrder: index,
                };
            });

        // Build short description from actual specification values
        const shortDescriptionParts = specifications.map(
            (spec) => `${spec.key}: ${spec.value}`
        );
        const shortDescription = shortDescriptionParts.length > 0
            ? shortDescriptionParts.join(", ")
            : category.name;

        const previewData = {
            name: productName,
            slug: uniqueSlug,
            description: category.configuration?.pageDescription || category.description || "",
            shortDescription: shortDescription,
            basePrice: rule.basePrice ? Number(rule.basePrice) : 0,
            categoryId: category.id,
            categoryName: category.name,
            specifications,
            specificationValues: specValues,
            pricingRuleId: rule.id,
        };

        return sendSuccess(res, previewData);
    } catch (error) {
        next(error);
    }
};

/**
 * Publish a pricing rule as a product
 */
export const publishPricingRuleAsProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");
        const {
            name,
            slug,
            description,
            shortDescription,
            stock,
            sku,
            minOrderQuantity,
            maxOrderQuantity,
            images,
            addonIds,
        } = req.body;

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            include: {
                pricingRules: {
                    where: { id: ruleId },
                },
                configuration: true,
                specifications: {
                    include: {
                        options: true,
                    },
                },
                images: {
                    where: { isPrimary: true },
                    take: 1,
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const rule = category.pricingRules[0];
        if (!rule) {
            throw new NotFoundError("Pricing rule not found");
        }

        if (rule.isPublished) {
            throw new ValidationError("This pricing rule is already published as a product");
        }

        if (!rule.basePrice) {
            throw new ValidationError("Pricing rule must have a base price to be published");
        }

        // Generate product name if not provided
        let productName = name;
        if (!productName) {
            const specValues = rule.specificationValues as Record<string, any>;
            const specParts: string[] = [];

            for (const spec of category.specifications) {
                const value = specValues[spec.slug];
                if (value) {
                    const option = spec.options.find((opt) => opt.value === value);
                    if (option) {
                        specParts.push(option.label);
                    } else {
                        specParts.push(String(value));
                    }
                }
            }

            productName = specParts.length > 0
                ? `${category.name} - ${specParts.join(" ")}`
                : category.name;
        }

        // Generate slug if not provided
        let productSlug = slug;
        if (!productSlug) {
            const baseSlug = productName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            let uniqueSlug = baseSlug;
            let counter = 1;
            while (await prisma.product.findUnique({ where: { slug: uniqueSlug } })) {
                uniqueSlug = `${baseSlug}-${counter}`;
                counter++;
            }
            productSlug = uniqueSlug;
        } else {
            // Check if slug is unique
            const existing = await prisma.product.findUnique({ where: { slug: productSlug } });
            if (existing) {
                throw new ValidationError("A product with this slug already exists");
            }
        }

        // Convert specification values to ProductSpecification format
        const specValues = rule.specificationValues as Record<string, any>;
        const productSpecifications = category.specifications
            .filter((spec) => specValues[spec.slug])
            .map((spec, index) => {
                const value = specValues[spec.slug];
                const option = spec.options.find((opt) => opt.value === value);
                
                // Build metadata object with spec info, option metadata (half-page, dependencies)
                const metadata: any = {
                    specSlug: spec.slug,
                    specName: spec.name,
                    optionValue: String(value),
                    optionLabel: option?.label || String(value),
                };
                
                // Include option metadata if available (half-page, dependencies)
                if (option?.metadata) {
                    const optionMetadata = option.metadata as any;
                    if (optionMetadata.isHalfPage) {
                        metadata.isHalfPage = true;
                    }
                    if (optionMetadata.allowedParentValues) {
                        metadata.allowedParentValues = optionMetadata.allowedParentValues;
                    }
                }
                
                // Include spec dependency info
                if (spec.dependsOn) {
                    metadata.dependsOn = spec.dependsOn;
                }
                
                return {
                    key: spec.name,
                    value: option ? option.label : String(value),
                    displayOrder: index,
                    metadata: metadata as Prisma.InputJsonValue,
                };
            });

        // Use provided images or copy category images
        let productImages = images;
        if (!productImages || productImages.length === 0) {
            productImages = category.images.map((img) => ({
                url: img.url,
                alt: img.alt || productName,
                isPrimary: img.isPrimary,
                displayOrder: img.displayOrder,
            }));
        }

        // Build short description from specifications if not provided
        let finalShortDescription = shortDescription;
        if (!finalShortDescription) {
            const shortDescriptionParts = productSpecifications.map(
                (spec) => `${spec.key}: ${spec.value}`
            );
            finalShortDescription = shortDescriptionParts.length > 0
                ? shortDescriptionParts.join(", ")
                : category.name;
        }

        // Create product
        const product = await prisma.product.create({
            data: {
                name: productName,
                slug: productSlug,
                description: description || category.configuration?.pageDescription || category.description || "",
                shortDescription: finalShortDescription,
                basePrice: rule.basePrice,
                categoryId: category.id,
                sku: sku || null,
                stock: stock || 0,
                minOrderQuantity: minOrderQuantity || 1,
                maxOrderQuantity: maxOrderQuantity || null,
                generatedFromPricingRule: true,
                images: productImages.length > 0
                    ? {
                        create: productImages.map((img: any, index: number) => ({
                            url: typeof img === "string" ? img : img.url,
                            alt: typeof img === "string" ? null : (img.alt || productName),
                            isPrimary: index === 0,
                            displayOrder: index,
                        })),
                    }
                    : undefined,
                specifications: productSpecifications.length > 0
                    ? {
                        create: productSpecifications,
                    }
                    : undefined,
            },
            include: {
                images: true,
                specifications: true,
                category: true,
            },
        });

        // Link pricing rule to product
        await prisma.categoryPricingRule.update({
            where: { id: ruleId }, 
            data: {
                productId: product.id,
                isPublished: true,
            },
        });

        // Link selected addons to product
        if (addonIds && Array.isArray(addonIds) && addonIds.length > 0) {
            // Verify all addon IDs are valid ADDON rules for this category
            const addonRules = await prisma.categoryPricingRule.findMany({
                where: {
                    id: { in: addonIds },
                    categoryId: category.id,
                    ruleType: 'ADDON',
                },
            });

            if (addonRules.length !== addonIds.length) {
                throw new ValidationError("Some addon IDs are invalid or not ADDON rules for this category");
            }

            // Create ProductAddon entries
            await prisma.productAddon.createMany({
                data: addonIds.map((addonId: string) => ({
                    productId: product.id,
                    addonRuleId: addonId,
                })),
                skipDuplicates: true,
            });
        }

        return sendSuccess(res, product, "Product published successfully", 201);
    } catch (error) {
        next(error);
    }
};

/**
 * Update a published product from its pricing rule
 */
export const updateProductFromPricingRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");
        const {
            name,
            slug,
            description,
            shortDescription,
            stock,
            sku,
            minOrderQuantity,
            maxOrderQuantity,
            images,
            addonIds,
        } = req.body;

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            include: {
                pricingRules: {
                    where: { id: ruleId },
                },
                configuration: true,
                specifications: {
                    include: {
                        options: true,
                    },
                },
            },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const rule = category.pricingRules[0];
        if (!rule) {
            throw new NotFoundError("Pricing rule not found");
        }

        if (!rule.isPublished || !rule.productId) {
            throw new ValidationError("This pricing rule is not published as a product");
        }

        // Get existing product
        const existingProduct = await prisma.product.findUnique({
            where: { id: rule.productId },
            include: {
                images: true,
                specifications: true,
            },
        });

        if (!existingProduct) {
            throw new NotFoundError("Product not found");
        }

        // Update product name if provided
        let productName = name || existingProduct.name;
        let productSlug = slug || existingProduct.slug;

        // If slug is being changed, check uniqueness
        if (slug && slug !== existingProduct.slug) {
            const existing = await prisma.product.findUnique({ where: { slug: productSlug } });
            if (existing && existing.id !== rule.productId) {
                throw new ValidationError("A product with this slug already exists");
            }
        }

        // Convert specification values to ProductSpecification format (same as publish)
        const specValues = rule.specificationValues as Record<string, any>;
        const productSpecifications = category.specifications
            .filter((spec) => specValues[spec.slug])
            .map((spec, index) => {
                const value = specValues[spec.slug];
                const option = spec.options.find((opt) => opt.value === value);
                
                // Build metadata object with spec info, option metadata (half-page, dependencies)
                const metadata: any = {
                    specSlug: spec.slug,
                    specName: spec.name,
                    optionValue: String(value),
                    optionLabel: option?.label || String(value),
                };
                
                // Include option metadata if available (half-page, dependencies)
                if (option?.metadata) {
                    const optionMetadata = option.metadata as any;
                    if (optionMetadata.isHalfPage) {
                        metadata.isHalfPage = true;
                    }
                    if (optionMetadata.allowedParentValues) {
                        metadata.allowedParentValues = optionMetadata.allowedParentValues;
                    }
                }
                
                // Include spec dependency info
                if (spec.dependsOn) {
                    metadata.dependsOn = spec.dependsOn;
                }
                
                return {
                    key: spec.name,
                    value: option ? option.label : String(value),
                    displayOrder: index,
                    metadata: metadata as Prisma.InputJsonValue,
                };
            });

        // Handle images
        let productImages: Array<{ url: string; alt?: string; isPrimary?: boolean; displayOrder?: number }> = [];
        if (images && Array.isArray(images) && images.length > 0) {
            productImages = images;
        } else if (existingProduct.images && existingProduct.images.length > 0) {
            // Keep existing images if none provided
            productImages = existingProduct.images.map((img) => ({
                url: img.url,
                alt: img.alt || undefined,
                isPrimary: img.isPrimary,
                displayOrder: img.displayOrder,
            }));
        }

        // Build short description
        let finalShortDescription = shortDescription;
        if (!finalShortDescription) {
            const shortDescriptionParts = productSpecifications.map(
                (spec) => `${spec.key}: ${spec.value}`
            );
            finalShortDescription = shortDescriptionParts.length > 0
                ? shortDescriptionParts.join(", ")
                : category.name;
        }

        // Update product
        const updatedProduct = await prisma.product.update({
            where: { id: rule.productId },
            data: {
                ...(name && { name: productName }),
                ...(slug && { slug: productSlug }),
                ...(description !== undefined && { description: description || category.configuration?.pageDescription || category.description || "" }),
                ...(shortDescription !== undefined && { shortDescription: finalShortDescription }),
                ...(stock !== undefined && { stock: stock || 0 }),
                ...(sku !== undefined && { sku: sku || null }),
                ...(minOrderQuantity !== undefined && { minOrderQuantity: minOrderQuantity || 1 }),
                ...(maxOrderQuantity !== undefined && { maxOrderQuantity: maxOrderQuantity || null }),
                // Update base price from rule if changed
                basePrice: rule.basePrice,
                // Update images
                images: productImages.length > 0
                    ? {
                        deleteMany: {},
                        create: productImages.map((img: any, index: number) => ({
                            url: typeof img === "string" ? img : img.url,
                            alt: typeof img === "string" ? null : (img.alt || productName),
                            isPrimary: index === 0,
                            displayOrder: index,
                        })),
                    }
                    : undefined,
            },
            include: {
                images: true,
                specifications: true,
                category: true,
            },
        });

        // Update specifications
        await prisma.productSpecification.deleteMany({
            where: { productId: rule.productId! },
        });

        if (productSpecifications.length > 0) {
            await prisma.productSpecification.createMany({
                data: productSpecifications.map((spec) => ({
                    productId: rule.productId!,
                    key: spec.key,
                    value: spec.value,
                    displayOrder: spec.displayOrder,
                    metadata: spec.metadata,
                })),
            });
        }

        // Update addons
        if (addonIds !== undefined) {
            // Remove all existing addons
            await prisma.productAddon.deleteMany({
                where: { productId: rule.productId! },
            });

            // Add new addons if provided
            if (Array.isArray(addonIds) && addonIds.length > 0) {
                const addonRules = await prisma.categoryPricingRule.findMany({
                    where: {
                        id: { in: addonIds },
                        categoryId: category.id,
                        ruleType: 'ADDON',
                    },
                });

                if (addonRules.length !== addonIds.length) {
                    throw new ValidationError("Some addon IDs are invalid or not ADDON rules for this category");
                }

                await prisma.productAddon.createMany({
                    data: addonIds.map((addonId: string) => ({
                        productId: rule.productId!,
                        addonRuleId: addonId,
                    })),
                    skipDuplicates: true,
                });
            }
        }

        return sendSuccess(res, updatedProduct, "Product updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Sync a published product with its source pricing rule
 */
export const syncProductFromCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleIdParam = req.params.ruleId; // Optional: sync specific rule
        const ruleId = ruleIdParam ? (Array.isArray(ruleIdParam) ? ruleIdParam[0] : ruleIdParam) : undefined;

        if (ruleId) {
            // Sync specific product
            await syncProductByPricingRule(ruleId);
            return sendSuccess(res, null, "Product synced successfully");
        } else {
            // Sync all products for category
            const result = await syncAllProductsForCategory(categoryId);
            return sendSuccess(res, result, `Synced ${result.synced} product(s)`);
        }
    } catch (error) {
        next(error);
    }
};
