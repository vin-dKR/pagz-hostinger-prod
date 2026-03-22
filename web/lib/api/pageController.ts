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

export async function getCategoryPageControllerRules(categorySlug: string): Promise<PageControllerRule[]> {
    const response = await get<PageControllerRule[]>(`/categories/${categorySlug}/page-controller`);
    if (!response.success || !response.data) {
        return [];
    }
    return response.data;
}
