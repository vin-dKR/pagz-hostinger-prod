import { get } from '../api-client';

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

/**
 * Get all active carousel items (public)
 */
export async function getCarousels(): Promise<Carousel[]> {
    const response = await get<Carousel[]>('/carousels');
    return response.data || [];
}
