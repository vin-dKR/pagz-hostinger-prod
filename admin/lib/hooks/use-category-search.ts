/**
 * TanStack Query hooks for category search (admin)
 * Used by ParentCategorySelector for parent selection UX.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
    searchCategories,
    getCategoryById,
    type CategorySearchResult,
    type Category,
} from '@/lib/api/categories.service';

export const categorySearchQueryKeys = {
    all: ['categories'] as const,
    search: (q: string, excludeId?: string, limit: number = 10) =>
        [...categorySearchQueryKeys.all, 'search', { q, excludeId, limit }] as const,
    byId: (id: string) => [...categorySearchQueryKeys.all, 'byId', id] as const,
};

export function useCategorySearch(
    query: string,
    options?: { excludeId?: string; limit?: number; enabled?: boolean }
) {
    const q = query.trim();
    const limit = options?.limit ?? 10;
    const excludeId = options?.excludeId;
    const enabled = options?.enabled ?? true;

    return useQuery({
        queryKey: categorySearchQueryKeys.search(q, excludeId, limit),
        queryFn: () => searchCategories(q, excludeId, limit),
        enabled: enabled && q.length > 0,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previous) => previous,
    });
}

export function useCategoryById(id?: string | null, enabled = true) {
    return useQuery({
        queryKey: id ? categorySearchQueryKeys.byId(id) : ['categories', 'byId', 'none'],
        queryFn: async (): Promise<Category | null> => {
            if (!id) return null;
            return await getCategoryById(id);
        },
        enabled: enabled && !!id,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

