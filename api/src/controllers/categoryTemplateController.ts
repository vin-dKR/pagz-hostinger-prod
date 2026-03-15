import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { getParamAsString } from "../utils/db-utils.js";

// ==================== Category Templates ====================

/**
 * Get all templates for a category
 */
export const getCategoryTemplates = async (
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

        const templates = await prisma.categoryTemplate.findMany({
            where: { categoryId },
            include: {
                form: true,
            },
            orderBy: { displayOrder: "asc" },
        });

        return sendSuccess(res, templates);
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single template by ID
 */
export const getCategoryTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const templateId = getParamAsString(req.params.templateId, "Template ID");

        const template = await prisma.categoryTemplate.findFirst({
            where: {
                id: templateId,
                categoryId,
            },
            include: {
                form: true,
            },
        });

        if (!template) {
            throw new NotFoundError("Template not found");
        }

        return sendSuccess(res, template);
    } catch (error) {
        next(error);
    }
};
 
/**
 * Create a new template for a category
 */
export const createCategoryTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const { name, description, previewImageUrl, displayOrder, isActive } = req.body;

        if (!name) {
            throw new ValidationError("Template name is required");
        }

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const template = await prisma.categoryTemplate.create({
            data: {
                categoryId,
                name: name.trim(),
                description: description?.trim() || null,
                previewImageUrl: previewImageUrl || null,
                displayOrder: displayOrder ?? 0,
                isActive: isActive !== undefined ? isActive : true,
            },
            include: {
                form: true,
            },
        });

        return sendSuccess(res, template, "Template created successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Update a template
 */
export const updateCategoryTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const templateId = getParamAsString(req.params.templateId, "Template ID");
        const { name, description, previewImageUrl, displayOrder, isActive } = req.body;

        const template = await prisma.categoryTemplate.findFirst({
            where: {
                id: templateId,
                categoryId,
            },
        });

        if (!template) {
            throw new NotFoundError("Template not found");
        }

        const updated = await prisma.categoryTemplate.update({
            where: { id: templateId },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(previewImageUrl !== undefined && { previewImageUrl: previewImageUrl || null }),
                ...(displayOrder !== undefined && { displayOrder }),
                ...(isActive !== undefined && { isActive }),
            },
            include: {
                form: true,
            },
        });

        return sendSuccess(res, updated, "Template updated successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a template
 */
export const deleteCategoryTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const templateId = getParamAsString(req.params.templateId, "Template ID");

        const template = await prisma.categoryTemplate.findFirst({
            where: {
                id: templateId,
                categoryId,
            },
        });

        if (!template) {
            throw new NotFoundError("Template not found");
        }

        // Delete template (form will be cascade deleted)
        await prisma.categoryTemplate.delete({
            where: { id: templateId },
        });

        return sendSuccess(res, null, "Template deleted successfully");
    } catch (error) {
        next(error);
    }
};

// ==================== Template Forms ====================

/**
 * Get form configuration for a template
 */
export const getTemplateForm = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const templateId = getParamAsString(req.params.templateId, "Template ID");

        const template = await prisma.categoryTemplate.findFirst({
            where: {
                id: templateId,
                categoryId,
            },
        });

        if (!template) {
            throw new NotFoundError("Template not found");
        }

        const form = await prisma.categoryTemplateForm.findUnique({
            where: { templateId },
        });

        return sendSuccess(res, form || null);
    } catch (error) {
        next(error);
    }
};

/**
 * Create or update form configuration for a template
 */
export const upsertTemplateForm = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const templateId = getParamAsString(req.params.templateId, "Template ID");
        const { fields, requiresImageUpload, imageUploadRequired } = req.body;

        const template = await prisma.categoryTemplate.findFirst({
            where: {
                id: templateId,
                categoryId,
            },
        });

        if (!template) {
            throw new NotFoundError("Template not found");
        }

        // Validate fields structure
        if (fields !== undefined) {
            if (!Array.isArray(fields)) {
                throw new ValidationError("Fields must be an array");
            }

            // Validate each field
            for (const field of fields) {
                if (!field.type || !field.label) {
                    throw new ValidationError("Each field must have type and label");
                }

                const validTypes = [
                    "text",
                    "number",
                    "email",
                    "phone",
                    "textarea",
                    "select",
                    "checkbox",
                    "file",
                ];

                if (!validTypes.includes(field.type)) {
                    throw new ValidationError(
                        `Invalid field type: ${field.type}. Valid types: ${validTypes.join(", ")}`
                    );
                }

                // Validate select options
                if (field.type === "select" && (!field.options || !Array.isArray(field.options))) {
                    throw new ValidationError("Select fields must have an options array");
                }
            }
        }

        const formData: any = {
            templateId,
            ...(fields !== undefined && { fields }),
            ...(requiresImageUpload !== undefined && { requiresImageUpload }),
            ...(imageUploadRequired !== undefined && { imageUploadRequired }),
        };

        const form = await prisma.categoryTemplateForm.upsert({
            where: { templateId },
            create: formData,
            update: formData,
        });

        return sendSuccess(res, form, "Form configuration saved successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Delete form configuration for a template
 */
export const deleteTemplateForm = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const templateId = getParamAsString(req.params.templateId, "Template ID");

        const template = await prisma.categoryTemplate.findFirst({
            where: {
                id: templateId,
                categoryId,
            },
        });

        if (!template) {
            throw new NotFoundError("Template not found");
        }

        const form = await prisma.categoryTemplateForm.findUnique({
            where: { templateId },
        });

        if (!form) {
            throw new NotFoundError("Form not found");
        }

        await prisma.categoryTemplateForm.delete({
            where: { templateId },
        });

        return sendSuccess(res, null, "Form deleted successfully");
    } catch (error) {
        next(error);
    }
};

// ==================== Public Endpoints ====================

/**
 * Get all active templates for a category (public endpoint by slug)
 */
export const getCategoryTemplatesBySlug = async (
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

        const templates = await prisma.categoryTemplate.findMany({
            where: {
                categoryId: category.id,
                isActive: true,
            },
            include: {
                form: {
                    select: {
                        id: true,
                        fields: true,
                        requiresImageUpload: true,
                        imageUploadRequired: true,
                    },
                },
            },
            orderBy: { displayOrder: "asc" },
        });

        return sendSuccess(res, templates);
    } catch (error) {
        next(error);
    }
};
