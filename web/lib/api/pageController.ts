/**
 * Page Controller API Service
 * Handles fetching page controller rules for categories
 */

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

/**
 * Get all active page controller rules for a category by slug
 */
export async function getCategoryPageControllerRules(
    categorySlug: string
): Promise<PageControllerRule[]> {
    const response = await get<PageControllerRule[]>(`/categories/${categorySlug}/page-controller`);
    if (!response.success || !response.data) {
        // Return empty array if no rules exist (backward compatibility)
        return [];
    }
    return response.data;
}
