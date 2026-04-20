"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CategoryReviewListResponse,
    CanReviewResponse,
    ReviewListParams,
    canReviewCategory,
    getCategoryReviews,
    removeHelpfulVote,
    voteReviewHelpful,
} from "@/lib/api/reviews";
import ReviewCard from "./ReviewCard";
import ReviewStatistics from "./ReviewStatistics";
import ReviewFilters from "./ReviewFilters";
import CategoryReviewForm from "./CategoryReviewForm";
import { BarsSpinner } from "../shared/BarsSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { toastError } from "@/lib/utils/toast";

interface CategoryReviewsSectionProps {
    categoryId: string;
}

interface HelpfulToggleArgs {
    reviewId: string;
    isHelpful: boolean; // desired next state (true = mark helpful, false = remove vote)
    prevVote: boolean | undefined; // existing vote state before the click (undefined = no vote)
}

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
    const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});
    const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());

    const queryKey = ["category-reviews", categoryId, filters] as const;
    const canReviewKey = ["can-review-category", categoryId] as const;

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

    const { data: canReviewData, isLoading: isCanReviewLoading } =
        useQuery<CanReviewResponse | null>({
            queryKey: canReviewKey,
            queryFn: async () => {
                const response = await canReviewCategory(categoryId);
                if (!response.success || !response.data) {
                    return null;
                }
                return response.data;
            },
            enabled: !!categoryId && isAuthenticated,
            staleTime: 60_000,
        });

    const reviews = data?.reviews ?? [];
    const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 0 };
    const ratingDistribution = data?.ratingDistribution ?? {};
    const verifiedPercentage = data?.verifiedPercentage ?? 0;
    const overallRating = data?.overallRating ?? 0;

    const helpfulMutation = useMutation<
        unknown,
        Error,
        HelpfulToggleArgs,
        { previousVote: boolean | undefined }
    >({
        mutationFn: async ({ reviewId, isHelpful, prevVote }) => {
            // Toggle-off: user already voted helpful and is clicking again
            if (prevVote === true && isHelpful === false) {
                const response = await removeHelpfulVote(reviewId);
                if (!response.success) {
                    throw new Error(response.error || "Failed to remove vote");
                }
                return response;
            }
            // Vote (or re-vote) as helpful
            const response = await voteReviewHelpful(reviewId, true);
            if (!response.success) {
                throw new Error(response.error || "Failed to vote");
            }
            return response;
        },
        onMutate: async ({ reviewId, isHelpful, prevVote }) => {
            setPendingVotes((prev) => {
                const next = new Set(prev);
                next.add(reviewId);
                return next;
            });
            setUserVotes((prev) => {
                const next = { ...prev };
                if (isHelpful) {
                    next[reviewId] = true;
                } else {
                    delete next[reviewId];
                }
                return next;
            });
            return { previousVote: prevVote };
        },
        onError: (err, { reviewId }, context) => {
            // Roll back
            setUserVotes((prev) => {
                const next = { ...prev };
                if (context && context.previousVote !== undefined) {
                    next[reviewId] = context.previousVote;
                } else {
                    delete next[reviewId];
                }
                return next;
            });
            toastError(err instanceof Error ? err.message : "Failed to vote");
        },
        onSettled: (_data, _err, { reviewId }) => {
            setPendingVotes((prev) => {
                const next = new Set(prev);
                next.delete(reviewId);
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ["category-reviews", categoryId] });
        },
    });

    const handleHelpfulClick = (reviewId: string, isHelpful: boolean) => {
        if (!user) {
            toastError("Please login to vote");
            return;
        }
        if (pendingVotes.has(reviewId)) return;

        const prevVote = Object.prototype.hasOwnProperty.call(userVotes, reviewId)
            ? userVotes[reviewId]
            : undefined;

        helpfulMutation.mutate({ reviewId, isHelpful, prevVote });
    };

    const handlePageChange = (newPage: number) => {
        setFilters((prev) => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const eligible = canReviewData?.eligible === true;
    const alreadyReviewed = canReviewData?.alreadyReviewed === true;
    const hasPurchased = canReviewData?.hasPurchased === true;

    const renderWriteReviewControl = () => {
        if (!isAuthenticated || showForm) return null;
        if (isCanReviewLoading) {
            return (
                <div className="px-4 py-2 text-sm text-gray-400 inline-flex items-center gap-2">
                    <BarsSpinner />
                </div>
            );
        }
        if (!canReviewData) {
            // Fallback — if the eligibility endpoint fails, let the user try (server will enforce)
            return (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                    Write a Review
                </button>
            );
        }
        if (alreadyReviewed) {
            return (
                <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium border border-gray-200">
                    You&apos;ve reviewed this category
                </span>
            );
        }
        if (eligible) {
            return (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                    Write a Review
                </button>
            );
        }
        // Not eligible because not purchased
        if (!hasPurchased) {
            return (
                <span className="text-xs text-gray-500 max-w-[240px] text-right">
                    Purchase from this category to post a review
                </span>
            );
        }
        return null;
    };

    return (
        <section className="bg-white py-8 md:py-12 border-t border-gray-100">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
                <div className="flex items-center justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-semibold text-gray-900">
                            Customer Reviews
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            What customers are saying about this category
                        </p>
                    </div>

                    {renderWriteReviewControl()}
                </div>

                {showForm && (
                    <CategoryReviewForm
                        categoryId={categoryId}
                        onSuccess={() => {
                            refetch();
                            queryClient.invalidateQueries({ queryKey: canReviewKey });
                            setShowForm(false);
                        }}
                        onCancel={() => setShowForm(false)}
                    />
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
                                    isHelpfulPending={pendingVotes.has(review.id)}
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
