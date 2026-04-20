/**
 * Reviews API functions
 */

import { get, post, put, del, ApiResponse } from '../api-client';

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
    user?: {
        id: string;
        name?: string;
        email: string;
    };
    helpfulVotes?: Array<{
        id: string;
        userId: string;
        isHelpful: boolean;
    }>;
}

export interface ReviewListParams {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'rating' | 'helpful';
    order?: 'asc' | 'desc';
    rating?: number;
    verified?: boolean;
    withImages?: boolean;
}

export interface ReviewListResponse {
    reviews: Review[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    ratingDistribution: Record<number, number>;
    verifiedPercentage: number;
}

export interface CreateReviewData {
    rating: number;
    title?: string;
    comment?: string;
    images?: string[];
}

export interface Testimonial {
    id: string;
    rating: number;
    title?: string | null;
    comment?: string | null;
    createdAt: string;
    user?: { id: string; name?: string | null };
    category?: { id: string; name: string; slug: string };
}

export interface CategoryReview extends Review {
    categoryId?: string;
    category?: { id: string; name: string; slug: string };
}

export interface CategoryReviewListResponse extends ReviewListResponse {
    overallRating: number | null;
}

export interface CreateCategoryReviewData extends CreateReviewData {
    productId?: string;
}

export interface UpdateReviewData {
    rating?: number;
    title?: string;
    comment?: string;
    images?: string[];
}

/**
 * Get product reviews
 */
export async function getProductReviews(
    productId: string,
    params?: ReviewListParams
): Promise<ApiResponse<ReviewListResponse>> {
    const queryParams = new URLSearchParams();

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
            }
        });
    }

    const queryString = queryParams.toString();
    return get<ReviewListResponse>(`/reviews/product/${productId}${queryString ? `?${queryString}` : ''}`);
}

/**
 * Create a review
 */
export async function createReview(
    productId: string,
    data: CreateReviewData
): Promise<ApiResponse<Review>> {
    return post<Review>(`/reviews/product/${productId}`, data);
}

/**
 * Update a review
 */
export async function updateReview(
    reviewId: string,
    data: UpdateReviewData
): Promise<ApiResponse<Review>> {
    return put<Review>(`/reviews/${reviewId}`, data);
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<ApiResponse<void>> {
    return del(`/reviews/${reviewId}`);
}

/**
 * Vote a review as helpful
 */
export async function voteReviewHelpful(
    reviewId: string,
    isHelpful: boolean = true
): Promise<ApiResponse<{ helpfulCount: number }>> {
    return post<{ helpfulCount: number }>(`/reviews/${reviewId}/helpful`, { isHelpful });
}

/**
 * Remove helpful vote from a review
 */
export async function removeHelpfulVote(
    reviewId: string
): Promise<ApiResponse<{ helpfulCount: number }>> {
    return del<{ helpfulCount: number }>(`/reviews/${reviewId}/helpful`);
}

/**
 * Get public testimonials (top-rated approved reviews, global feed)
 */
export async function getTestimonials(
    limit: number = 12
): Promise<ApiResponse<{ testimonials: Testimonial[] }>> {
    return get<{ testimonials: Testimonial[] }>(`/reviews/testimonials?limit=${limit}`);
}

/**
 * Get category reviews
 */
export async function getCategoryReviews(
    categoryId: string,
    params?: ReviewListParams
): Promise<ApiResponse<CategoryReviewListResponse>> {
    const queryParams = new URLSearchParams();

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
            }
        });
    }

    const queryString = queryParams.toString();
    return get<CategoryReviewListResponse>(
        `/reviews/category/${categoryId}${queryString ? `?${queryString}` : ''}`
    );
}

/**
 * Create a category review
 */
export async function createCategoryReview(
    categoryId: string,
    data: CreateCategoryReviewData
): Promise<ApiResponse<CategoryReview>> {
    return post<CategoryReview>(`/reviews/category/${categoryId}`, data);
}

export interface CanReviewResponse {
    eligible: boolean;
    reason: 'not_purchased' | 'already_reviewed' | null;
    alreadyReviewed: boolean;
    hasPurchased: boolean;
}

/**
 * Check whether the current user can post a review for a given category.
 */
export async function canReviewCategory(
    categoryId: string,
): Promise<ApiResponse<CanReviewResponse>> {
    return get<CanReviewResponse>(`/reviews/category/${categoryId}/can-review`);
}

