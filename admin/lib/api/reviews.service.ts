/**
 * Reviews Service
 * Handles review management operations for admin
 */

import { get, put, del, post } from './api-client';

export interface Review {
    id: string;
    productId: string;
    userId: string;
    rating: number;
    title?: string;
    comment?: string;
    images: string[];
    isVerifiedPurchase: boolean;
    isHelpful: number;
    isApproved: boolean;
    createdAt: string;
    updatedAt: string;
    product?: {
        id: string;
        name: string;
    };
    user?: {
        id: string;
        name?: string;
        email: string;
    };
}

export interface UpdateReviewData {
    isApproved?: boolean;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: PaginationMeta;
}

export interface ReviewQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    rating?: number;
    isApproved?: boolean;
    productId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    isVerifiedPurchase?: boolean;
}

export interface ReviewStatistics {
    totalReviews: number;
    approvedReviews: number;
    pendingReviews: number;
    avgRating: number;
    approvalRate: number;
    verifiedPercentage: number;
    ratingDistribution: Record<number, number>;
    reviewsByDate: Array<{ date: string; count: number }>;
    mostReviewedProducts: Array<{
        productId: string;
        productName: string;
        reviewCount: number;
    }>;
}

/**
 * Get all reviews with pagination and search
 */
export async function getReviews(
    params?: ReviewQueryParams
): Promise<PaginatedResponse<Review>> {
    const queryString = new URLSearchParams();
    if (params?.page) queryString.append('page', params.page.toString());
    if (params?.limit) queryString.append('limit', params.limit.toString());
    if (params?.search) queryString.append('search', params.search);
    if (params?.rating) queryString.append('rating', params.rating.toString());
    if (params?.isApproved !== undefined) queryString.append('isApproved', params.isApproved.toString());

    const response = await get<PaginatedResponse<Review>>(
        `/admin/reviews?${queryString.toString()}`
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch reviews');
    }

    return response.data;
}

/**
 * Get single review by ID
 */
export async function getReview(id: string): Promise<Review> {
    const response = await get<Review>(`/admin/reviews/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch review');
    }

    return response.data;
}

/**
 * Update review (approve/reject)
 */
export async function updateReview(id: string, data: UpdateReviewData): Promise<Review> {
    const response = await put<Review>(`/admin/reviews/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update review');
    }

    return response.data;
}

/**
 * Delete review
 */
export async function deleteReview(id: string): Promise<void> {
    const response = await del(`/admin/reviews/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete review');
    }
}

/**
 * Approve review
 */
export async function approveReview(
    id: string,
    notifyUser?: boolean
): Promise<Review> {
    const response = await post<Review>(`/admin/reviews/${id}/approve`, { notifyUser });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to approve review');
    }

    return response.data;
}

/**
 * Reject review with reason
 */
export async function rejectReview(
    id: string,
    reason: string,
    notifyUser?: boolean
): Promise<void> {
    const response = await post<{ reason: string }>(`/admin/reviews/${id}/reject`, { reason, notifyUser });

    if (!response.success) {
        throw new Error(response.error || 'Failed to reject review');
    }
}

/**
 * Get review statistics
 */
export async function getReviewStatistics(params?: {
    dateFrom?: string;
    dateTo?: string;
    productId?: string;
}): Promise<ReviewStatistics> {
    const queryString = new URLSearchParams();
    if (params?.dateFrom) queryString.append('dateFrom', params.dateFrom);
    if (params?.dateTo) queryString.append('dateTo', params.dateTo);
    if (params?.productId) queryString.append('productId', params.productId);

    const response = await get<ReviewStatistics>(
        `/admin/reviews/statistics?${queryString.toString()}`
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch statistics');
    }

    return response.data;
}

/**
 * Bulk approve reviews
 */
export async function bulkApproveReviews(reviewIds: string[]): Promise<{ count: number }> {
    const response = await post<{ count: number }>('/admin/reviews/bulk-approve', { reviewIds });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to bulk approve reviews');
    }

    return response.data;
}

/**
 * Bulk reject reviews
 */
export async function bulkRejectReviews(
    reviewIds: string[],
    reason: string
): Promise<{ count: number; reason: string }> {
    const response = await post<{ count: number; reason: string }>('/admin/reviews/bulk-reject', {
        reviewIds,
        reason,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to bulk reject reviews');
    }

    return response.data;
}

/**
 * Bulk delete reviews
 */
export async function bulkDeleteReviews(reviewIds: string[]): Promise<{ count: number }> {
    const response = await post<{ count: number }>('/admin/reviews/bulk-delete', { reviewIds });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to bulk delete reviews');
    }

    return response.data;
}

/**
 * Edit review (admin edit with full capabilities)
 * Uses the updateAdminReview endpoint with extended data
 */
export async function editAdminReview(
    id: string,
    data: {
        rating?: number;
        title?: string;
        comment?: string;
        images?: string[];
        isApproved?: boolean;
        isVerifiedPurchase?: boolean;
    }
): Promise<Review> {
    const response = await put<Review>(`/admin/reviews/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update review');
    }

    return response.data;
}

