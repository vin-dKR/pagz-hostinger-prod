/**
 * TanStack Query hooks for categories
 * Optimized with caching and prefetching
 */

import { useQuery } from '@tanstack/react-query';
import { getAllCategories } from '@/lib/api/categories';

// Query Keys
export const categoryQueryKeys = {
    all: ['categories'] as const,
    lists: () => [...categoryQueryKeys.all, 'list'] as const,
    list: () => [...categoryQueryKeys.lists()] as const,
    detail: (slug: string) => [...categoryQueryKeys.all, 'detail', slug] as const,
};

/**
 * Hook to fetch all categories with aggressive caching
 */
export function useCategories() {
    return useQuery({
        queryKey: categoryQueryKeys.list(),
        queryFn: () => getAllCategories(),
        staleTime: 5 * 60 * 1000, // 5 minutes - categories don't change often
        gcTime: 10 * 60 * 1000, // 10 minutes cache
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook to fetch categories (alternative API endpoint from products API)
 */
export function useCategoriesList() {
    return useQuery({
        queryKey: [...categoryQueryKeys.list(), 'api'],
        queryFn: async () => {
            // Import dynamically to avoid circular dependencies
            const { getCategories } = await import('@/lib/api/products');
            const response = await getCategories();
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
