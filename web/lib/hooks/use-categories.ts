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
 * Extended cache times to reduce AWS bandwidth costs for category images
 */
export function useCategories() {
    return useQuery({
        queryKey: categoryQueryKeys.list(),
        queryFn: () => getAllCategories(),
        staleTime: 30 * 60 * 1000, // 30 minutes - categories don't change often, reduces AWS bandwidth
        gcTime: 60 * 60 * 1000, // 1 hour cache - keeps category images cached longer
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Don't refetch if data exists in cache
    });
}

/**
 * Hook to fetch categories (alternative API endpoint from products API)
 * Extended cache times to reduce AWS bandwidth costs for category images
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
        staleTime: 30 * 60 * 1000, // 30 minutes - reduces AWS bandwidth
        gcTime: 60 * 60 * 1000, // 1 hour cache - keeps category images cached longer
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Don't refetch if data exists in cache
    });
}
