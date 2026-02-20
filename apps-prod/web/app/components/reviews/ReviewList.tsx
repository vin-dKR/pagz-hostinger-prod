"use client";

import { useState, useEffect } from "react";
import { Review, ReviewListParams, getProductReviews, voteReviewHelpful, removeHelpfulVote } from "@/lib/api/reviews";
import ReviewCard from "./ReviewCard";
import ReviewStatistics from "./ReviewStatistics";
import ReviewFilters from "./ReviewFilters";
import ReviewForm from "./ReviewForm";
import { BarsSpinner } from "../shared/BarsSpinner";
import { toastError } from "@/lib/utils/toast";
import { useAuth } from "@/contexts/AuthContext";

interface ReviewListProps {
    productId: string;
    productRating?: number;
    productTotalReviews?: number;
}

export default function ReviewList({
    productId,
    productRating = 0,
    productTotalReviews = 0,
}: ReviewListProps) {
    const { user } = useAuth();
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<ReviewListParams>({
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        order: "desc",
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    });
    const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({});
    const [verifiedPercentage, setVerifiedPercentage] = useState(0);
    const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadReviews();
    }, [productId, filters]);

    const loadReviews = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getProductReviews(productId, filters);

            if (response.success && response.data) {
                setReviews(response.data.reviews || []);
                setPagination(response.data.pagination);
                setRatingDistribution(response.data.ratingDistribution || {});
                setVerifiedPercentage(response.data.verifiedPercentage || 0);

                // Map user votes
                const votesMap: Record<string, boolean> = {};
                response.data.reviews.forEach((review) => {
                    if (review.helpfulVotes && review.helpfulVotes.length > 0) {
                        const vote = review.helpfulVotes[0];
                        votesMap[review.id] = vote?.isHelpful || false;
                    }
                });
                setUserVotes(votesMap);
            } else {
                throw new Error(response.error || "Failed to load reviews");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to load reviews";
            setError(errorMessage);
            toastError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleHelpfulClick = async (reviewId: string, isHelpful: boolean) => {
        if (!user) {
            toastError("Please login to vote");
            return;
        }

        try {
            const hasVoted = userVotes.hasOwnProperty(reviewId);
            const currentVote = userVotes[reviewId];

            if (hasVoted && currentVote === isHelpful) {
                // Remove vote if clicking the same button
                const response = await removeHelpfulVote(reviewId);
                if (response.success && response.data) {
                    setUserVotes((prev) => {
                        const newVotes = { ...prev };
                        delete newVotes[reviewId];
                        return newVotes;
                    });
                    // Update review helpful count
                    setReviews((prev) =>
                        prev.map((r) =>
                            r.id === reviewId
                                ? { ...r, isHelpful: response.data!.helpfulCount }
                                : r
                        )
                    );
                }
            } else {
                // Add or update vote
                const response = await voteReviewHelpful(reviewId, isHelpful);
                if (response.success && response.data) {
                    setUserVotes((prev) => ({
                        ...prev,
                        [reviewId]: isHelpful,
                    }));
                    // Update review helpful count
                    setReviews((prev) =>
                        prev.map((r) =>
                            r.id === reviewId
                                ? { ...r, isHelpful: response.data!.helpfulCount }
                                : r
                        )
                    );
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to vote";
            toastError(errorMessage);
        }
    };

    const handlePageChange = (newPage: number) => {
        setFilters((prev) => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Calculate average rating from distribution
    const calculateAverageRating = () => {
        if (productTotalReviews > 0 && productRating > 0) {
            return productRating;
        }

        const total = Object.values(ratingDistribution).reduce((sum, count) => sum + count, 0);
        if (total === 0) return 0;

        const weightedSum = Object.entries(ratingDistribution).reduce(
            (sum, [rating, count]) => sum + parseInt(rating) * count,
            0
        );
        return weightedSum / total;
    };

    const averageRating = calculateAverageRating();
    const displayTotalReviews = productTotalReviews || pagination.total;

    const handleReviewSuccess = () => {
        setShowReviewForm(false);
        // Reload reviews after successful submission
        loadReviews();
    };

    return (
        <div className="space-y-6">
            {/* Write Review Button / Form */}
            {!showReviewForm ? (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowReviewForm(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                    >
                        Write a Review
                    </button>
                </div>
            ) : (
                <ReviewForm
                    productId={productId}
                    onSuccess={handleReviewSuccess}
                    onCancel={() => setShowReviewForm(false)}
                />
            )}

            {/* Statistics */}
            <ReviewStatistics
                averageRating={averageRating}
                totalReviews={displayTotalReviews}
                ratingDistribution={ratingDistribution}
                verifiedPercentage={verifiedPercentage}
            />

            {/* Filters */}
            <ReviewFilters
                filters={filters}
                onFiltersChange={setFilters}
                totalReviews={displayTotalReviews}
            />

            {/* Reviews List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <BarsSpinner />
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-red-700">{error}</p>
                    <button
                        onClick={loadReviews}
                        className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                        Try Again
                    </button>
                </div>
            ) : reviews.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-600 mb-2">No reviews found</p>
                    <p className="text-sm text-gray-500">
                        Be the first to review this product!
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <ReviewCard
                                key={review.id}
                                review={review}
                                onHelpfulClick={handleHelpfulClick}
                                hasVoted={userVotes.hasOwnProperty(review.id)}
                                userVote={userVotes[review.id]}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>

                            <span className="px-4 py-2 text-sm text-gray-700">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>

                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

