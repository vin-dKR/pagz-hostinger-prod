/**
 * TanStack Query hooks for category templates
 * Optimized with caching and prefetching to reduce S3 costs
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCategoryTemplates, type CategoryTemplate } from '@/lib/api/templates';
import { getPublicS3Url } from '@/lib/utils/s3';

// Query Keys
export const categoryTemplateQueryKeys = {
    all: ['category-templates'] as const,
    lists: () => [...categoryTemplateQueryKeys.all, 'list'] as const,
    list: (categorySlug: string) => [...categoryTemplateQueryKeys.lists(), categorySlug] as const,
    detail: (categorySlug: string, templateId: string) => 
        [...categoryTemplateQueryKeys.list(categorySlug), templateId] as const,
};

/**
 * Prefetch images for templates to reduce S3 requests
 * Images are cached by the browser, reducing redundant S3 calls
 */
function prefetchTemplateImages(templates: CategoryTemplate[]) {
    templates.forEach((template) => {
        if (template.previewImageUrl) {
            const imageUrl = getPublicS3Url(template.previewImageUrl);
            // Create an image element to trigger browser caching
            const img = new Image();
            img.src = imageUrl;
        }
    });
}

/**
 * Hook to fetch templates for a category with aggressive caching
 * Automatically prefetches images to reduce S3 costs
 */
export function useCategoryTemplates(categorySlug: string, enabled: boolean = true) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: categoryTemplateQueryKeys.list(categorySlug),
        queryFn: async () => {
            const templates = await getCategoryTemplates(categorySlug);
            // Prefetch images in the background to reduce S3 requests
            // This leverages browser caching - once loaded, images won't hit S3 again
            prefetchTemplateImages(templates);
            return templates;
        },
        enabled: enabled && !!categorySlug,
        staleTime: 10 * 60 * 1000, // 10 minutes - templates don't change often
        gcTime: 30 * 60 * 1000, // 30 minutes cache - longer for images
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Don't refetch if data exists in cache
    });
}

/**
 * Prefetch templates for a category (useful for prefetching on hover)
 */
export function usePrefetchCategoryTemplates() {
    const queryClient = useQueryClient();

    return (categorySlug: string) => {
        queryClient.prefetchQuery({
            queryKey: categoryTemplateQueryKeys.list(categorySlug),
            queryFn: () => getCategoryTemplates(categorySlug),
            staleTime: 10 * 60 * 1000,
        });
    };
}
