import { get, post, put, del } from './api-client';

export interface Carousel {
    id: string;
    imageUrl: string;
    alt?: string | null;
    categoryId?: string | null;
    displayOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    category?: {
        id: string;
        name: string;
        slug: string;
    } | null;
}

export interface CreateCarouselData {
    imageUrl: string;
    alt?: string;
    categoryId?: string | null;
    displayOrder?: number;
    isActive?: boolean;
}

export interface UpdateCarouselData {
    imageUrl?: string;
    alt?: string | null;
    categoryId?: string | null;
    displayOrder?: number;
    isActive?: boolean;
}

export interface ReorderCarouselData {
    items: Array<{
        id: string;
        displayOrder: number;
    }>;
}

/**
 * Get all carousel items (admin)
 */
export async function getCarouselsApi(): Promise<Carousel[]> {
    const response = await get<Carousel[]>('/admin/carousels');

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch carousels');
    }

    return response.data;
}

/**
 * Get single carousel item (admin)
 */
export async function getCarouselApi(id: string): Promise<Carousel> {
    const response = await get<Carousel>(`/admin/carousels/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch carousel');
    }

    return response.data;
}

/**
 * Create carousel item
 */
export async function createCarouselApi(data: CreateCarouselData): Promise<Carousel> {
    const response = await post<Carousel>('/admin/carousels', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create carousel');
    }

    return response.data;
}

/**
 * Update carousel item
 */
export async function updateCarouselApi(id: string, data: UpdateCarouselData): Promise<Carousel> {
    const response = await put<Carousel>(`/admin/carousels/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update carousel');
    }

    return response.data;
}

/**
 * Delete carousel item
 */
export async function deleteCarouselApi(id: string): Promise<void> {
    const response = await del<null>(`/admin/carousels/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete carousel');
    }
}

/**
 * Reorder carousel items
 */
export async function reorderCarouselsApi(data: ReorderCarouselData): Promise<Carousel[]> {
    const response = await post<Carousel[]>('/admin/carousels/reorder', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to reorder carousels');
    }

    return response.data;
}

/**
 * Upload carousel image file to S3
 */
export async function uploadCarouselImageApi(
    file: File,
    options?: { alt?: string }
): Promise<{ url: string; key: string; filename: string; size: number; mimetype: string; alt?: string | null }> {
    const { uploadFile } = await import('./api-client');
    const formData: Record<string, string> = {};
    if (options?.alt) formData.alt = options.alt;

    const response = await uploadFile<{ url: string; key: string; filename: string; size: number; mimetype: string; alt?: string | null }>(
        `/admin/upload/carousel-image`,
        file,
        formData
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to upload carousel image');
    }

    return response.data;
}
