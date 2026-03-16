/**
 * Category Page Controller Service
 * Handles page controller rule management operations
 */

import { get, post, put, del } from './api-client';

export interface CategoryPageControllerRule {
    id: string;
    categoryId: string;
    specificationSlug: string | null;
    optionValue: string | null;
    maxPages: number;
    isActive: boolean;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePageControllerRuleData {
    specificationSlug?: string | null;
    optionValue?: string | null;
    maxPages: number;
    isActive?: boolean;
    displayOrder?: number;
}

export interface UpdatePageControllerRuleData {
    specificationSlug?: string | null;
    optionValue?: string | null;
    maxPages?: number;
    isActive?: boolean;
    displayOrder?: number;
}

/**
 * Get all page controller rules for a category
 */
export async function getCategoryPageControllerRules(
    categoryId: string
): Promise<CategoryPageControllerRule[]> {
    const response = await get<CategoryPageControllerRule[]>(
        `/admin/categories/${categoryId}/page-controller`
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch page controller rules');
    }
    return response.data;
}

/**
 * Get a single page controller rule by ID
 */
export async function getCategoryPageControllerRule(
    categoryId: string,
    ruleId: string
): Promise<CategoryPageControllerRule> {
    const response = await get<CategoryPageControllerRule>(
        `/admin/categories/${categoryId}/page-controller/${ruleId}`
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch page controller rule');
    }
    return response.data;
}

/**
 * Create a new page controller rule
 */
export async function createCategoryPageControllerRule(
    categoryId: string,
    data: CreatePageControllerRuleData
): Promise<CategoryPageControllerRule> {
    const response = await post<CategoryPageControllerRule>(
        `/admin/categories/${categoryId}/page-controller`,
        data
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create page controller rule');
    }
    return response.data;
}

/**
 * Update a page controller rule
 */
export async function updateCategoryPageControllerRule(
    categoryId: string,
    ruleId: string,
    data: UpdatePageControllerRuleData
): Promise<CategoryPageControllerRule> {
    const response = await put<CategoryPageControllerRule>(
        `/admin/categories/${categoryId}/page-controller/${ruleId}`,
        data
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update page controller rule');
    }
    return response.data;
}

/**
 * Delete a page controller rule
 */
export async function deleteCategoryPageControllerRule(
    categoryId: string,
    ruleId: string
): Promise<void> {
    await del(`/admin/categories/${categoryId}/page-controller/${ruleId}`);
}
