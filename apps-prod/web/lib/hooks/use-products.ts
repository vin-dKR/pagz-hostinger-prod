/**
 * TanStack Query hooks for products
 * Optimized with caching, prefetching, and request deduplication
 */

import { useQuery, useInfiniteQuery, UseQueryOptions } from '@tanstack/react-query';
import { getProducts, getProduct, type Product, type ProductListParams, type ProductListResponse } from '@/lib/api/products';

// Query Keys
export const productQueryKeys = {
    all: ['products'] as const,
    lists: () => [...productQueryKeys.all, 'list'] as const,
    list: (params?: ProductListParams) => [...productQueryKeys.lists(), params] as const,
    detail: (id: string) => [...productQueryKeys.all, 'detail', id] as const,
    search: (query: string, params?: Omit<ProductListParams, 'search'>) =>
        [...productQueryKeys.all, 'search', query, params] as const,
    category: (category: string, params?: Omit<ProductListParams, 'category'>) =>
        [...productQueryKeys.all, 'category', category, params] as const,
};

/**
 * Hook to fetch products with filters and pagination
 * Optimized with caching and request deduplication
 */
export function useProducts(
    params?: ProductListParams,
    options?: Omit<UseQueryOptions<{ success: boolean; data?: ProductListResponse; error?: string }>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: productQueryKeys.list(params),
        queryFn: async () => {
            const response = await getProducts(params);
            return response;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes - products can change
        gcTime: 5 * 60 * 1000, // 5 minutes cache
        refetchOnWindowFocus: false,
        ...options,
    });
}

/**
 * Hook to fetch a single product by ID
 */
export function useProduct(id: string, options?: Omit<UseQueryOptions<{ success: boolean; data?: Product; error?: string }>, 'queryKey' | 'queryFn'>) {
    return useQuery({
        queryKey: productQueryKeys.detail(id),
        queryFn: async () => {
            const response = await getProduct(id);
            return response;
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        ...options,
    });
}

/**
 * Hook for infinite scrolling products
 */
export function useInfiniteProducts(params?: ProductListParams) {
    return useInfiniteQuery({
        queryKey: productQueryKeys.list(params),
        queryFn: async ({ pageParam = 1 }) => {
            const response = await getProducts({ ...params, page: pageParam });
            return response;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (!lastPage.data?.pagination) return undefined;
            const { page, totalPages } = lastPage.data.pagination;
            return page < totalPages ? page + 1 : undefined;
        },
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });
}
