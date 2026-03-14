/**
 * TanStack Query hook for carousel
 * Optimized with caching to reduce bandwidth
 */

import { useQuery } from '@tanstack/react-query';
import { getCarousels } from '@/lib/api/carousel';

// Query Keys
export const carouselQueryKeys = {
    all: ['carousels'] as const,
    lists: () => [...carouselQueryKeys.all, 'list'] as const,
    list: () => [...carouselQueryKeys.lists()] as const,
};

/**
 * Hook to fetch carousel items with aggressive caching
 * Images are cached to reduce bandwidth usage
 */
export function useCarousel() {
    return useQuery({
        queryKey: carouselQueryKeys.list(),
        queryFn: () => getCarousels(),
        staleTime: 10 * 60 * 1000, // 10 minutes - carousel doesn't change often
        gcTime: 30 * 60 * 1000, // 30 minutes cache - keep images cached longer
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Don't refetch if data exists in cache
    });
}
