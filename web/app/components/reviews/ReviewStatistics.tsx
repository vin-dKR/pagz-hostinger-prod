"use client";

import { Star } from "lucide-react";

interface ReviewStatisticsProps {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
    verifiedPercentage: number;
}

export default function ReviewStatistics({
    averageRating,
    totalReviews,
    ratingDistribution,
    verifiedPercentage,
}: ReviewStatisticsProps) {
    const getRatingPercentage = (rating: number) => {
        if (totalReviews === 0) return 0;
        const count = ratingDistribution[rating] || 0;
        return (count / totalReviews) * 100;
    };

    const getRatingBarWidth = (rating: number) => {
        return `${getRatingPercentage(rating)}%`;
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-6 space-y-6">
            {/* Overall Rating */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-6 border-b border-gray-100">
                <div className="flex-shrink-0">
                    <div className="text-5xl font-bold text-gray-900">
                        {averageRating.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                                key={i}
                                size={20}
                                className={i < Math.floor(averageRating)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }
                            />
                        ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                    </p>
                </div>

                {/* Rating Breakdown */}
                <div className="flex-1 w-full md:w-auto">
                    <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((rating) => (
                            <div key={rating} className="flex items-center gap-3">
                                <div className="flex items-center gap-1 w-20">
                                    <span className="text-sm text-gray-600 w-3">{rating}</span>
                                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                </div>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-400 transition-all duration-300"
                                        style={{ width: getRatingBarWidth(rating) }}
                                    />
                                </div>
                                <span className="text-sm text-gray-600 w-12 text-right">
                                    {ratingDistribution[rating] || 0}
                                </span>
                                <span className="text-xs text-gray-400 w-12 text-right">
                                    ({getRatingPercentage(rating).toFixed(0)}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Verified Purchase Percentage */}
            {verifiedPercentage > 0 && (
                <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Verified Purchases</span>
                        <span className="text-sm font-medium text-gray-900">
                            {verifiedPercentage.toFixed(0)}%
                        </span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${verifiedPercentage}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

