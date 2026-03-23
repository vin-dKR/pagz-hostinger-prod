import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { getParamAsString } from "../utils/db-utils.js";

interface RulePayload {
    specificationSlug?: string | null;
    optionValue?: string | null;
    maxPages?: number;
    isActive?: boolean;
    displayOrder?: number;
}

interface PageControllerSettingsPayload {
    showBulkToggle?: boolean;
    bulkToggleLabel?: string;
    copiesLabel?: string;
}

const PAGE_CONTROLLER_SETTINGS_DEFAULTS = {
    showBulkToggle: true,
    bulkToggleLabel: "Do you need in bulks?",
    copiesLabel: "Number of Quantity/Copies",
};

const getPageControllerSettingsFromLayoutConfig = (layoutConfig: unknown): Required<PageControllerSettingsPayload> => {
    const config = layoutConfig && typeof layoutConfig === "object" ? (layoutConfig as Record<string, unknown>) : {};
    const pageControllerUi =
        config.pageControllerUi && typeof config.pageControllerUi === "object"
            ? (config.pageControllerUi as Record<string, unknown>)
            : {};

    return {
        showBulkToggle:
            typeof pageControllerUi.showBulkToggle === "boolean"
                ? pageControllerUi.showBulkToggle
                : PAGE_CONTROLLER_SETTINGS_DEFAULTS.showBulkToggle,
        bulkToggleLabel:
            typeof pageControllerUi.bulkToggleLabel === "string" && pageControllerUi.bulkToggleLabel.trim() !== ""
                ? pageControllerUi.bulkToggleLabel
                : PAGE_CONTROLLER_SETTINGS_DEFAULTS.bulkToggleLabel,
        copiesLabel:
            typeof pageControllerUi.copiesLabel === "string" && pageControllerUi.copiesLabel.trim() !== ""
                ? pageControllerUi.copiesLabel
                : PAGE_CONTROLLER_SETTINGS_DEFAULTS.copiesLabel,
    };
};

const validateSettingsPayload = (payload: PageControllerSettingsPayload): void => {
    if (payload.showBulkToggle !== undefined && typeof payload.showBulkToggle !== "boolean") {
        throw new ValidationError("showBulkToggle must be a boolean");
    }
    if (payload.bulkToggleLabel !== undefined && payload.bulkToggleLabel.trim() === "") {
        throw new ValidationError("bulkToggleLabel cannot be empty");
    }
    if (payload.copiesLabel !== undefined && payload.copiesLabel.trim() === "") {
        throw new ValidationError("copiesLabel cannot be empty");
    }
};

const validateRulePayload = (payload: RulePayload, requireMaxPages: boolean): void => {
    if (requireMaxPages && (payload.maxPages === undefined || payload.maxPages < 1)) {
        throw new ValidationError("maxPages is required and must be at least 1");
    }

    if (payload.maxPages !== undefined && payload.maxPages < 1) {
        throw new ValidationError("maxPages must be at least 1");
    }

    const hasSpec = payload.specificationSlug !== undefined && payload.specificationSlug !== null && payload.specificationSlug !== "";
    const hasOption = payload.optionValue !== undefined && payload.optionValue !== null && payload.optionValue !== "";

    if (hasSpec && !hasOption) {
        throw new ValidationError("optionValue is required when specificationSlug is provided");
    }

    if (!hasSpec && hasOption) {
        throw new ValidationError("specificationSlug is required when optionValue is provided");
    }
};

const validateSpecOption = async (
    categoryId: string,
    specificationSlug?: string | null,
    optionValue?: string | null
): Promise<void> => {
    if (!specificationSlug || !optionValue) return;

    const specification = await prisma.categorySpecification.findFirst({
        where: { categoryId, slug: specificationSlug },
        include: {
            options: { where: { value: optionValue, isActive: true } },
        },
    });

    if (!specification) {
        throw new NotFoundError(`Specification "${specificationSlug}" not found`);
    }

    if (specification.options.length === 0) {
        throw new NotFoundError(`Option "${optionValue}" not found for specification "${specificationSlug}"`);
    }
};

export const getCategoryPageControllerRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const rules = await prisma.categoryPageControllerRule.findMany({
            where: { categoryId },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        });
        return sendSuccess(res, rules);
    } catch (error) {
        next(error);
    }
};

export const getCategoryPageControllerRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");

        const rule = await prisma.categoryPageControllerRule.findFirst({
            where: { id: ruleId, categoryId },
        });

        if (!rule) throw new NotFoundError("Page controller rule not found");
        return sendSuccess(res, rule);
    } catch (error) {
        next(error);
    }
};

export const createCategoryPageControllerRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const payload = req.body as RulePayload;

        validateRulePayload(payload, true);
        await validateSpecOption(categoryId, payload.specificationSlug, payload.optionValue);

        const rule = await prisma.categoryPageControllerRule.create({
            data: {
                categoryId,
                specificationSlug: payload.specificationSlug || null,
                optionValue: payload.optionValue || null,
                maxPages: payload.maxPages!,
                isActive: payload.isActive ?? true,
                displayOrder: payload.displayOrder ?? 0,
            },
        });

        return sendSuccess(res, rule, "Page controller rule created successfully", 201);
    } catch (error) {
        next(error);
    }
};

export const updateCategoryPageControllerRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");
        const payload = req.body as RulePayload;

        const existing = await prisma.categoryPageControllerRule.findFirst({
            where: { id: ruleId, categoryId },
        });
        if (!existing) throw new NotFoundError("Page controller rule not found");

        validateRulePayload(payload, false);

        const nextSpec = payload.specificationSlug !== undefined ? payload.specificationSlug : existing.specificationSlug;
        const nextOption = payload.optionValue !== undefined ? payload.optionValue : existing.optionValue;
        await validateSpecOption(categoryId, nextSpec, nextOption);

        const updated = await prisma.categoryPageControllerRule.update({
            where: { id: ruleId },
            data: {
                ...(payload.specificationSlug !== undefined ? { specificationSlug: payload.specificationSlug || null } : {}),
                ...(payload.optionValue !== undefined ? { optionValue: payload.optionValue || null } : {}),
                ...(payload.maxPages !== undefined ? { maxPages: payload.maxPages } : {}),
                ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
                ...(payload.displayOrder !== undefined ? { displayOrder: payload.displayOrder } : {}),
            },
        });

        return sendSuccess(res, updated, "Page controller rule updated successfully");
    } catch (error) {
        next(error);
    }
};

export const deleteCategoryPageControllerRule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const ruleId = getParamAsString(req.params.ruleId, "Rule ID");

        const existing = await prisma.categoryPageControllerRule.findFirst({
            where: { id: ruleId, categoryId },
        });
        if (!existing) throw new NotFoundError("Page controller rule not found");

        await prisma.categoryPageControllerRule.delete({ where: { id: ruleId } });
        return sendSuccess(res, { message: "Page controller rule deleted successfully" });
    } catch (error) {
        next(error);
    }
};

export const getCategoryPageControllerRulesBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");

        const category = await prisma.category.findUnique({ where: { slug } });
        if (!category) throw new NotFoundError("Category not found");

        const rules = await prisma.categoryPageControllerRule.findMany({
            where: { categoryId: category.id, isActive: true },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        });

        return sendSuccess(res, rules);
    } catch (error) {
        next(error);
    }
};

export const getCategoryPageControllerSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const configuration = await prisma.categoryConfiguration.findUnique({
            where: { categoryId },
            select: { layoutConfig: true },
        });

        const settings = getPageControllerSettingsFromLayoutConfig(configuration?.layoutConfig);
        return sendSuccess(res, settings);
    } catch (error) {
        next(error);
    }
};

export const upsertCategoryPageControllerSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categoryId = getParamAsString(req.params.categoryId, "Category ID");
        const payload = req.body as PageControllerSettingsPayload;
        validateSettingsPayload(payload);

        const existing = await prisma.categoryConfiguration.findUnique({
            where: { categoryId },
            select: { layoutConfig: true },
        });

        const currentLayoutConfig =
            existing?.layoutConfig && typeof existing.layoutConfig === "object"
                ? (existing.layoutConfig as Record<string, unknown>)
                : {};
        const currentSettings = getPageControllerSettingsFromLayoutConfig(existing?.layoutConfig);
        const nextSettings = {
            ...currentSettings,
            ...(payload.showBulkToggle !== undefined ? { showBulkToggle: payload.showBulkToggle } : {}),
            ...(payload.bulkToggleLabel !== undefined ? { bulkToggleLabel: payload.bulkToggleLabel } : {}),
            ...(payload.copiesLabel !== undefined ? { copiesLabel: payload.copiesLabel } : {}),
        };

        const nextLayoutConfig = {
            ...currentLayoutConfig,
            pageControllerUi: nextSettings,
        };

        await prisma.categoryConfiguration.upsert({
            where: { categoryId },
            update: { layoutConfig: nextLayoutConfig },
            create: { categoryId, layoutConfig: nextLayoutConfig },
        });

        return sendSuccess(res, nextSettings, "Page controller settings updated successfully");
    } catch (error) {
        next(error);
    }
};

export const getCategoryPageControllerSettingsBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const slug = getParamAsString(req.params.slug, "Category slug");
        const category = await prisma.category.findUnique({ where: { slug } });
        if (!category) throw new NotFoundError("Category not found");

        const configuration = await prisma.categoryConfiguration.findUnique({
            where: { categoryId: category.id },
            select: { layoutConfig: true },
        });

        const settings = getPageControllerSettingsFromLayoutConfig(configuration?.layoutConfig);
        return sendSuccess(res, settings);
    } catch (error) {
        next(error);
    }
};
