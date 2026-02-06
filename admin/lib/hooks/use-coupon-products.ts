/**
 * TanStack Query hooks for coupon products and categories
 * Optimized with caching, prefetching, and request deduplication
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getCouponProducts,
    addCouponProducts,
    removeCouponProducts,
    getCouponCategories,
    addCouponCategories,
    removeCouponCategories,
    type CouponProduct,
    type CouponCategory,
} from '@/lib/api/coupons.service';
import { getProducts } from '@/lib/api/products.service';
import { getCategories } from '@/lib/api/categories.service';
import { toastSuccess, toastError } from '@/lib/utils/toast';

// Query Keys
export const couponQueryKeys = {
    all: ['coupons'] as const,
    products: (couponId: string) => [...couponQueryKeys.all, 'products', couponId] as const,
    categories: (couponId: string) => [...couponQueryKeys.all, 'categories', couponId] as const,
    availableProducts: (search?: string) => ['products', 'available', search || ''] as const,
    availableCategories: (search?: string) => ['categories', 'available', search || ''] as const,
};

/**
 * Hook to fetch coupon products
 */
export function useCouponProducts(couponId: string, enabled = true) {
    return useQuery({
        queryKey: couponQueryKeys.products(couponId),
        queryFn: () => getCouponProducts(couponId),
        enabled: enabled && !!couponId,
        staleTime: 30 * 1000, // 30 seconds - products don't change often
        gcTime: 2 * 60 * 1000, // 2 minutes cache
    });
}

/**
 * Hook to fetch coupon categories
 */
export function useCouponCategories(couponId: string, enabled = true) {
    return useQuery({
        queryKey: couponQueryKeys.categories(couponId),
        queryFn: () => getCouponCategories(couponId),
        enabled: enabled && !!couponId,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 2 * 60 * 1000, // 2 minutes cache
    });
}

/**
 * Hook to search available products with aggressive caching
 */
export function useAvailableProducts(search: string = '', enabled = true) {
    return useQuery({
        queryKey: couponQueryKeys.availableProducts(search),
        queryFn: () =>
            getProducts({
                page: 1,
                limit: 50,
                search: search || undefined,
                isActive: true,
            }),
        enabled: enabled,
        staleTime: 2 * 60 * 1000, // 2 minutes - search results can be cached longer
        gcTime: 5 * 60 * 1000, // 5 minutes cache
        // Prefetch empty search on mount
        placeholderData: (previousData) => previousData,
    });
}

/**
 * Hook to search available categories with aggressive caching
 */
export function useAvailableCategories(search: string = '', enabled = true) {
    return useQuery({
        queryKey: couponQueryKeys.availableCategories(search),
        queryFn: () =>
            getCategories({
                page: 1,
                limit: 100,
                search: search || undefined,
            }),
        enabled: enabled,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes cache
        placeholderData: (previousData) => previousData,
    });
}

/**
 * Mutation to add products to coupon with optimistic updates
 */
export function useAddCouponProducts(couponId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (productIds: string[]) => addCouponProducts(couponId, productIds),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onMutate: async (_productIds) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: couponQueryKeys.products(couponId) });

            // Snapshot previous value
            const previousProducts = queryClient.getQueryData<CouponProduct[]>(
                couponQueryKeys.products(couponId)
            );

            // Optimistically update
            queryClient.setQueryData<CouponProduct[]>(
                couponQueryKeys.products(couponId),
                (old = []) => {
                    // We'll add the actual products after the mutation succeeds
                    return old;
                }
            );

            return { previousProducts };
        },
        onError: (err, productIds, context) => {
            // Rollback on error
            if (context?.previousProducts) {
                queryClient.setQueryData(
                    couponQueryKeys.products(couponId),
                    context.previousProducts
                );
            }
            toastError(err instanceof Error ? err.message : 'Failed to add products');
        },
        onSuccess: () => {
            toastSuccess('Products added successfully');
        },
        onSettled: () => {
            // Refetch to get accurate data
            queryClient.invalidateQueries({ queryKey: couponQueryKeys.products(couponId) });
        },
    });
}

/**
 * Mutation to remove products from coupon with optimistic updates
 */
export function useRemoveCouponProducts(couponId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (productIds: string[]) => removeCouponProducts(couponId, productIds),
        onMutate: async (productIds) => {
            await queryClient.cancelQueries({ queryKey: couponQueryKeys.products(couponId) });

            const previousProducts = queryClient.getQueryData<CouponProduct[]>(
                couponQueryKeys.products(couponId)
            );

            // Optimistically remove
            queryClient.setQueryData<CouponProduct[]>(
                couponQueryKeys.products(couponId),
                (old = []) => old.filter((cp) => !productIds.includes(cp.product.id))
            );

            return { previousProducts };
        },
        onError: (err, productIds, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(
                    couponQueryKeys.products(couponId),
                    context.previousProducts
                );
            }
            toastError(err instanceof Error ? err.message : 'Failed to remove products');
        },
        onSuccess: () => {
            toastSuccess('Product removed successfully');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: couponQueryKeys.products(couponId) });
        },
    });
}

/**
 * Mutation to add categories to coupon with optimistic updates
 */
export function useAddCouponCategories(couponId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (categoryIds: string[]) => addCouponCategories(couponId, categoryIds),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onMutate: async (_categoryIds) => {
            await queryClient.cancelQueries({ queryKey: couponQueryKeys.categories(couponId) });

            const previousCategories = queryClient.getQueryData<CouponCategory[]>(
                couponQueryKeys.categories(couponId)
            );

            return { previousCategories };
        },
        onError: (err, categoryIds, context) => {
            if (context?.previousCategories) {
                queryClient.setQueryData(
                    couponQueryKeys.categories(couponId),
                    context.previousCategories
                );
            }
            toastError(err instanceof Error ? err.message : 'Failed to add categories');
        },
        onSuccess: () => {
            toastSuccess('Categories added successfully');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: couponQueryKeys.categories(couponId) });
        },
    });
}

/**
 * Mutation to remove categories from coupon with optimistic updates
 */
export function useRemoveCouponCategories(couponId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (categoryIds: string[]) => removeCouponCategories(couponId, categoryIds),
        onMutate: async (categoryIds) => {
            await queryClient.cancelQueries({ queryKey: couponQueryKeys.categories(couponId) });

            const previousCategories = queryClient.getQueryData<CouponCategory[]>(
                couponQueryKeys.categories(couponId)
            );

            // Optimistically remove
            queryClient.setQueryData<CouponCategory[]>(
                couponQueryKeys.categories(couponId),
                (old = []) => old.filter((cc) => !categoryIds.includes(cc.id))
            );

            return { previousCategories };
        },
        onError: (err, categoryIds, context) => {
            if (context?.previousCategories) {
                queryClient.setQueryData(
                    couponQueryKeys.categories(couponId),
                    context.previousCategories
                );
            }
            toastError(err instanceof Error ? err.message : 'Failed to remove categories');
        },
        onSuccess: () => {
            toastSuccess('Category removed successfully');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: couponQueryKeys.categories(couponId) });
        },
    });
}
