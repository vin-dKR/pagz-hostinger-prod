import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoupons, getCouponById, getCouponProducts, type Coupon } from '@/lib/api/offers';

// Query keys for consistent caching
export const couponQueryKeys = {
    all: ['coupons'] as const,
    lists: () => [...couponQueryKeys.all, 'list'] as const,
    list: (filters?: string) => [...couponQueryKeys.lists(), { filters }] as const,
    details: () => [...couponQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...couponQueryKeys.details(), id] as const,
    products: (id: string) => [...couponQueryKeys.detail(id), 'products'] as const,
};

/**
 * Hook to fetch all coupons
 * Uses TanStack Query for caching and optimization
 */
export function useCoupons() {
    return useQuery({
        queryKey: couponQueryKeys.list(),
        queryFn: async () => {
            const response = await getCoupons();
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to fetch coupons');
            }
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook to fetch a single coupon by ID
 * Uses cached data if available, otherwise fetches
 */
export function useCoupon(id: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: couponQueryKeys.detail(id!),
        queryFn: async () => {
            if (!id) throw new Error('Coupon ID is required');
            const response = await getCouponById(id);
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to fetch coupon');
            }
            return response.data;
        },
        enabled: !!id,
        // Use cached data from the list if available
        initialData: () => {
            const coupons = queryClient.getQueryData<Coupon[]>(couponQueryKeys.list());
            return coupons?.find((coupon) => coupon.id === id);
        },
        initialDataUpdatedAt: () => {
            const queryState = queryClient.getQueryState(couponQueryKeys.list());
            return queryState?.dataUpdatedAt;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook to fetch products for a specific coupon
 */
export function useCouponProducts(id: string | undefined) {
    return useQuery({
        queryKey: couponQueryKeys.products(id!),
        queryFn: async () => {
            if (!id) throw new Error('Coupon ID is required');
            const response = await getCouponProducts(id);
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to fetch coupon products');
            }
            return response.data;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Prefetch coupon data on hover
 * This optimizes navigation by loading data before user clicks
 */
export function usePrefetchCoupon() {
    const queryClient = useQueryClient();

    return (couponId: string) => {
        // Prefetch coupon detail
        queryClient.prefetchQuery({
            queryKey: couponQueryKeys.detail(couponId),
            queryFn: async () => {
                const response = await getCouponById(couponId);
                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to fetch coupon');
                }
                return response.data;
            },
            staleTime: 1000 * 60 * 5,
        });

        // Prefetch coupon products
        queryClient.prefetchQuery({
            queryKey: couponQueryKeys.products(couponId),
            queryFn: async () => {
                const response = await getCouponProducts(couponId);
                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to fetch coupon products');
                }
                return response.data;
            },
            staleTime: 1000 * 60 * 5,
        });
    };
}
