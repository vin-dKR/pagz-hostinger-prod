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

export interface UpsertCategoryPageControllerRuleData {
    specificationSlug?: string | null;
    optionValue?: string | null;
    maxPages?: number;
    isActive?: boolean;
    displayOrder?: number;
}

export interface CategoryPageControllerSettings {
    showBulkToggle: boolean;
    bulkToggleLabel: string;
    copiesLabel: string;
}

export async function getCategoryPageControllerRules(categoryId: string): Promise<CategoryPageControllerRule[]> {
    const response = await get<CategoryPageControllerRule[]>(`/admin/categories/${categoryId}/page-controller`);
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch page controller rules');
    }
    return response.data;
}

export async function getCategoryPageControllerSettings(categoryId: string): Promise<CategoryPageControllerSettings> {
    const response = await get<CategoryPageControllerSettings>(`/admin/categories/${categoryId}/page-controller/settings`);
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch page controller settings');
    }
    return response.data;
}

export async function updateCategoryPageControllerSettings(
    categoryId: string,
    data: Partial<CategoryPageControllerSettings>
): Promise<CategoryPageControllerSettings> {
    const response = await put<CategoryPageControllerSettings>(
        `/admin/categories/${categoryId}/page-controller/settings`,
        data
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update page controller settings');
    }
    return response.data;
}

export async function createCategoryPageControllerRule(
    categoryId: string,
    data: UpsertCategoryPageControllerRuleData
): Promise<CategoryPageControllerRule> {
    const response = await post<CategoryPageControllerRule>(`/admin/categories/${categoryId}/page-controller`, data);
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create page controller rule');
    }
    return response.data;
}

export async function updateCategoryPageControllerRule(
    categoryId: string,
    ruleId: string,
    data: UpsertCategoryPageControllerRuleData
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

export async function deleteCategoryPageControllerRule(categoryId: string, ruleId: string): Promise<void> {
    await del(`/admin/categories/${categoryId}/page-controller/${ruleId}`);
}
