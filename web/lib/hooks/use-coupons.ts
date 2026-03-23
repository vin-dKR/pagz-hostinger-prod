import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCoupons, getCouponById, getCouponCategories, getCouponProducts, type Coupon } from '@/lib/api/offers';

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
        const msg = (error as { message?: unknown }).message;
        if (typeof msg === 'string' && msg) return msg;
    }
    return fallback;
}

// Query keys for consistent caching
export const couponQueryKeys = {
    all: ['coupons'] as const,
    lists: () => [...couponQueryKeys.all, 'list'] as const,
    list: (filters?: string) => [...couponQueryKeys.lists(), { filters }] as const,
    details: () => [...couponQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...couponQueryKeys.details(), id] as const,
    categories: (id: string) => [...couponQueryKeys.detail(id), 'categories'] as const,
};

/**
 * Hook to fetch all coupons
 * Uses TanStack Query for caching and optimization
 */
export function useCoupons() {
    return useQuery({
        queryKey: couponQueryKeys.list(),
        queryFn: async () => {
            try {
                const response = await getCoupons();
                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to fetch coupons');
                }
                return response.data;
            } catch (error) {
                throw new Error(getErrorMessage(error, 'Failed to fetch coupons'));
            }
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
            try {
                const response = await getCouponById(id);
                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to fetch coupon');
                }
                return response.data;
            } catch (error) {
                throw new Error(getErrorMessage(error, 'Failed to fetch coupon'));
            }
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
 * Hook to fetch categories for a specific coupon
 */
export function useCouponCategories(id: string | undefined) {
    return useQuery({
        queryKey: couponQueryKeys.categories(id!),
        queryFn: async () => {
            if (!id) throw new Error('Coupon ID is required');
            try {
                const response = await getCouponCategories(id);
                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to fetch coupon categories');
                }
                return response.data;
            } catch (error) {
                // Backward-compatible fallback: derive unique categories from coupon products
                // if categories endpoint is unavailable on older API deployments.
                try {
                    const productsResponse = await getCouponProducts(id);
                    if (!productsResponse.success || !productsResponse.data) {
                        throw new Error(productsResponse.error || 'Failed to fetch coupon categories');
                    }

                    const categoryMap = new Map<
                        string,
                        { id: string; name: string; slug: string; imageUrl?: string | null; productCount: number }
                    >();

                    for (const product of productsResponse.data) {
                        const category = product.category;
                        if (!category) continue;
                        const existing = categoryMap.get(category.id);
                        if (existing) {
                            existing.productCount += 1;
                        } else {
                            categoryMap.set(category.id, {
                                id: category.id,
                                name: category.name,
                                slug: category.slug,
                                imageUrl: null,
                                productCount: 1,
                            });
                        }
                    }

                    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
                } catch {
                    throw new Error(getErrorMessage(error, 'Failed to fetch coupon categories'));
                }
            }
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
                try {
                    const response = await getCouponById(couponId);
                    if (!response.success || !response.data) {
                        throw new Error(response.error || 'Failed to fetch coupon');
                    }
                    return response.data;
                } catch (error) {
                    throw new Error(getErrorMessage(error, 'Failed to fetch coupon'));
                }
            },
            staleTime: 1000 * 60 * 5,
        });

        // Prefetch coupon categories
        queryClient.prefetchQuery({
            queryKey: couponQueryKeys.categories(couponId),
            queryFn: async () => {
                try {
                    const response = await getCouponCategories(couponId);
                    if (!response.success || !response.data) {
                        throw new Error(response.error || 'Failed to fetch coupon categories');
                    }
                    return response.data;
                } catch (error) {
                    throw new Error(getErrorMessage(error, 'Failed to fetch coupon categories'));
                }
            },
            staleTime: 1000 * 60 * 5,
        });
    };
}
