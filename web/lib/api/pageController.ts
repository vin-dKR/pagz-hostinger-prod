import { get } from '../api-client';

export interface PageControllerRule {
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

export interface PageControllerUiSettings {
    showBulkToggle: boolean;
    bulkToggleLabel: string;
    copiesLabel: string;
}

export async function getCategoryPageControllerRules(categorySlug: string): Promise<PageControllerRule[]> {
    const response = await get<PageControllerRule[]>(`/categories/${categorySlug}/page-controller`);
    if (!response.success || !response.data) {
        return [];
    }
    return response.data;
}

export async function getCategoryPageControllerSettings(categorySlug: string): Promise<PageControllerUiSettings> {
    const response = await get<PageControllerUiSettings>(`/categories/${categorySlug}/page-controller/settings`);
    if (!response.success || !response.data) {
        return {
            showBulkToggle: true,
            bulkToggleLabel: 'Do you need in bulks?',
            copiesLabel: 'Number of Quantity/Copies',
        };
    }
    return response.data;
}
