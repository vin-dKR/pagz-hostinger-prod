/**
 * TanStack Query hooks for coupons management
 * Optimized with caching, prefetching, and request deduplication
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getCoupons,
    getCoupon,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getCouponStats,
    getCouponAnalytics,
    getCouponUsages,
    bulkCouponOperation,
    type Coupon,
    type CreateCouponData,
    type UpdateCouponData,
} from '@/lib/api/coupons.service';
import { toastSuccess, toastError } from '@/lib/utils/toast';

// Query Keys
export const couponsQueryKeys = {
    all: ['coupons'] as const,
    lists: () => [...couponsQueryKeys.all, 'list'] as const,
    list: (filters?: string) => [...couponsQueryKeys.lists(), { filters }] as const,
    details: () => [...couponsQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...couponsQueryKeys.details(), id] as const,
    stats: () => [...couponsQueryKeys.all, 'stats'] as const,
    analytics: (id: string) => [...couponsQueryKeys.all, 'analytics', id] as const,
    usages: (id: string, page?: number) => [...couponsQueryKeys.detail(id), 'usages', page] as const,
};

/**
 * Hook to fetch all coupons with aggressive caching
 */
export function useCoupons() {
    return useQuery({
        queryKey: couponsQueryKeys.list(),
        queryFn: () => getCoupons(),
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes cache
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook to fetch a single coupon by ID
 * Uses cached data from the list if available
 */
export function useCoupon(id: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: couponsQueryKeys.detail(id!),
        queryFn: () => {
            if (!id) throw new Error('Coupon ID is required');
            return getCoupon(id);
        },
        enabled: !!id,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        // Use cached data from the list if available
        initialData: () => {
            const coupons = queryClient.getQueryData<Coupon[]>(couponsQueryKeys.list());
            return coupons?.find((coupon) => coupon.id === id);
        },
        initialDataUpdatedAt: () => {
            const queryState = queryClient.getQueryState(couponsQueryKeys.list());
            return queryState?.dataUpdatedAt;
        },
    });
}

/**
 * Hook to fetch coupon statistics
 */
export function useCouponStats() {
    return useQuery({
        queryKey: couponsQueryKeys.stats(),
        queryFn: () => getCouponStats(),
        staleTime: 60 * 1000, // 1 minute - stats don't change often
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook to fetch coupon analytics
 */
export function useCouponAnalytics(id: string | undefined) {
    return useQuery({
        queryKey: couponsQueryKeys.analytics(id!),
        queryFn: () => {
            if (!id) throw new Error('Coupon ID is required');
            return getCouponAnalytics(id);
        },
        enabled: !!id,
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000,
    });
}

/**
 * Hook to fetch coupon usage history with pagination
 */
export function useCouponUsages(id: string | undefined, page: number = 1, limit: number = 20) {
    return useQuery({
        queryKey: couponsQueryKeys.usages(id!, page),
        queryFn: () => {
            if (!id) throw new Error('Coupon ID is required');
            return getCouponUsages(id, page, limit);
        },
        enabled: !!id,
        staleTime: 0, // Always refetch to get latest usage data
        gcTime: 1 * 60 * 1000, // 1 minute cache
        refetchOnMount: true, // Always refetch when component mounts
        refetchOnWindowFocus: false, // Don't refetch on window focus
    });
}

/**
 * Mutation to create a new coupon
 */
export function useCreateCoupon() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateCouponData) => createCoupon(data),
        onSuccess: () => {
            // Invalidate lists to refetch
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.stats() });
            toastSuccess('Coupon created successfully');
        },
        onError: (err) => {
            toastError(err instanceof Error ? err.message : 'Failed to create coupon');
        },
    });
}

/**
 * Mutation to update a coupon
 */
export function useUpdateCoupon() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateCouponData) => updateCoupon(data),
        onSuccess: (updatedCoupon) => {
            // Update the specific coupon in cache
            queryClient.setQueryData(couponsQueryKeys.detail(updatedCoupon.id), updatedCoupon);
            // Update in list cache
            queryClient.setQueryData<Coupon[]>(couponsQueryKeys.list(), (old) => {
                if (!old) return old;
                return old.map((c) => (c.id === updatedCoupon.id ? updatedCoupon : c));
            });
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.stats() });
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.analytics(updatedCoupon.id) });
            toastSuccess('Coupon updated successfully');
        },
        onError: (err) => {
            toastError(err instanceof Error ? err.message : 'Failed to update coupon');
        },
    });
}

/**
 * Mutation to delete a coupon
 */
export function useDeleteCoupon() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteCoupon(id),
        onSuccess: (_, deletedId) => {
            // Remove from list cache
            queryClient.setQueryData<Coupon[]>(couponsQueryKeys.list(), (old) => {
                if (!old) return old;
                return old.filter((c) => c.id !== deletedId);
            });
            // Remove detail cache
            queryClient.removeQueries({ queryKey: couponsQueryKeys.detail(deletedId) });
            // Invalidate stats
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.stats() });
            toastSuccess('Coupon deleted successfully');
        },
        onError: (err) => {
            toastError(err instanceof Error ? err.message : 'Failed to delete coupon');
        },
    });
}

/**
 * Mutation for bulk coupon operations
 */
export function useBulkCouponOperation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            ids,
            operation,
        }: {
            ids: string[];
            operation: 'activate' | 'deactivate' | 'delete';
        }) => bulkCouponOperation(ids, operation),
        onSuccess: (_, variables) => {
            // Invalidate lists and stats
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: couponsQueryKeys.stats() });

            // If delete, remove from cache
            if (variables.operation === 'delete') {
                variables.ids.forEach((id) => {
                    queryClient.removeQueries({ queryKey: couponsQueryKeys.detail(id) });
                });
            }

            toastSuccess(
                `Successfully ${variables.operation}d ${variables.ids.length} coupon(s)`
            );
        },
        onError: (err) => {
            toastError(err instanceof Error ? err.message : 'Bulk operation failed');
        },
    });
}

/**
 * Prefetch coupon data on hover
 */
export function usePrefetchCoupon() {
    const queryClient = useQueryClient();

    return (couponId: string) => {
        queryClient.prefetchQuery({
            queryKey: couponsQueryKeys.detail(couponId),
            queryFn: () => getCoupon(couponId),
            staleTime: 30 * 1000,
        });
    };
}
