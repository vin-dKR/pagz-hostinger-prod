"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, CheckCircle2 } from "lucide-react";
import {
    CategoryReviewListResponse,
    CreateCategoryReviewData,
    ReviewListParams,
    createCategoryReview,
    getCategoryReviews,
    removeHelpfulVote,
    voteReviewHelpful,
} from "@/lib/api/reviews";
import ReviewCard from "./ReviewCard";
import ReviewStatistics from "./ReviewStatistics";
import ReviewFilters from "./ReviewFilters";
import { BarsSpinner } from "../shared/BarsSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { toastError, toastSuccess, toastInfo } from "@/lib/utils/toast";

interface CategoryReviewsSectionProps {
    categoryId: string;
}

const MAX_TITLE_LENGTH = 100;
const MAX_COMMENT_LENGTH = 1000;

export default function CategoryReviewsSection({ categoryId }: CategoryReviewsSectionProps) {
    const { user, isAuthenticated } = useAuth();
    const queryClient = useQueryClient();

    const [filters, setFilters] = useState<ReviewListParams>({
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        order: "desc",
    });
    const [showForm, setShowForm] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [title, setTitle] = useState("");
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});

    const queryKey = ["category-reviews", categoryId, filters] as const;

    const { data, isLoading, error, refetch } = useQuery<CategoryReviewListResponse>({
        queryKey,
        queryFn: async () => {
            const response = await getCategoryReviews(categoryId, filters);
            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to load reviews");
            }
            return response.data;
        },
        enabled: !!categoryId,
    });

    const reviews = data?.reviews ?? [];
    const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 0 };
    const ratingDistribution = data?.ratingDistribution ?? {};
    const verifiedPercentage = data?.verifiedPercentage ?? 0;
    const overallRating = data?.overallRating ?? 0;

    const handleHelpfulClick = async (reviewId: string, isHelpful: boolean) => {
        if (!user) {
            toastError("Please login to vote");
            return;
        }

        try {
            const hasVoted = Object.prototype.hasOwnProperty.call(userVotes, reviewId);
            const currentVote = userVotes[reviewId];

            if (hasVoted && currentVote === isHelpful) {
                const response = await removeHelpfulVote(reviewId);
                if (response.success) {
                    setUserVotes((prev) => {
                        const newVotes = { ...prev };
                        delete newVotes[reviewId];
                        return newVotes;
                    });
                    queryClient.invalidateQueries({ queryKey: ["category-reviews", categoryId] });
                }
            } else {
                const response = await voteReviewHelpful(reviewId, isHelpful);
                if (response.success) {
                    setUserVotes((prev) => ({ ...prev, [reviewId]: isHelpful }));
                    queryClient.invalidateQueries({ queryKey: ["category-reviews", categoryId] });
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

    const resetForm = () => {
        setRating(0);
        setTitle("");
        setComment("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
            toastError("Please login to submit a review");
            return;
        }

        if (rating < 1 || rating > 5) {
            toastError("Please select a rating");
            return;
        }

        if (!title.trim() && !comment.trim()) {
            toastError("Please provide either a title or comment");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: CreateCategoryReviewData = {
                rating,
                title: title.trim() || undefined,
                comment: comment.trim() || undefined,
            };

            const response = await createCategoryReview(categoryId, payload);

            if (response.success) {
                toastSuccess("Review submitted successfully");
                setTimeout(() => {
                    toastInfo("Your review is pending admin approval.", 5000);
                }, 400);
                resetForm();
                setShowForm(false);
                refetch();
            } else {
                throw new Error(response.error || "Failed to submit review");
            }
        } catch (err) {
            const anyErr = err as { statusCode?: number; message?: string } | Error;
            const statusCode = (anyErr as { statusCode?: number }).statusCode;
            if (statusCode === 403) {
                toastError("You must purchase from this category before reviewing");
            } else {
                const errorMessage = err instanceof Error
                    ? err.message
                    : "Failed to submit review";
                toastError(errorMessage);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="bg-white py-8 md:py-12 border-t border-gray-100">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-semibold text-gray-900">
                            Customer Reviews
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            What customers are saying about this category
                        </p>
                    </div>

                    {isAuthenticated && !showForm && (
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                        >
                            Write a Review
                        </button>
                    )}
                </div>

                {showForm && (
                    <form
                        onSubmit={handleSubmit}
                        className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4 mb-6"
                    >
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rating <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoveredRating(star)}
                                        onMouseLeave={() => setHoveredRating(0)}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={28}
                                            className={
                                                star <= (hoveredRating || rating)
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-gray-300"
                                            }
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={MAX_TITLE_LENGTH}
                                placeholder="Give your review a title"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Your Review
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                maxLength={MAX_COMMENT_LENGTH}
                                rows={4}
                                placeholder="Share your experience..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => {
                                    resetForm();
                                    setShowForm(false);
                                }}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || rating === 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <BarsSpinner />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Submit
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <BarsSpinner />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <p className="text-red-700">
                            {error instanceof Error ? error.message : "Failed to load reviews"}
                        </p>
                        <button
                            onClick={() => refetch()}
                            className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                        <p className="text-gray-600 mb-2">No reviews yet</p>
                        <p className="text-sm text-gray-500">
                            Be the first to share your experience!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <ReviewStatistics
                            averageRating={overallRating ?? 0}
                            totalReviews={pagination.total}
                            ratingDistribution={ratingDistribution}
                            verifiedPercentage={verifiedPercentage}
                        />

                        <ReviewFilters
                            filters={filters}
                            onFiltersChange={setFilters}
                            totalReviews={pagination.total}
                        />

                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    onHelpfulClick={handleHelpfulClick}
                                    hasVoted={Object.prototype.hasOwnProperty.call(userVotes, review.id)}
                                    userVote={userVotes[review.id]}
                                />
                            ))}
                        </div>

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
                    </div>
                )}
            </div>
        </section>
    );
}
