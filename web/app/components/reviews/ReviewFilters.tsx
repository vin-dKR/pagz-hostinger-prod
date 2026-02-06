"use client";

import { useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { ReviewListParams } from "@/lib/api/reviews";

interface ReviewFiltersProps {
    filters: ReviewListParams;
    onFiltersChange: (filters: ReviewListParams) => void;
    totalReviews: number;
}

export default function ReviewFilters({
    filters,
    onFiltersChange,
    totalReviews,
}: ReviewFiltersProps) {
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const sortOptions = [
        { value: "createdAt", label: "Most Recent" },
        { value: "rating", label: "Highest Rating" },
        { value: "helpful", label: "Most Helpful" },
    ] as const;

    const ratingOptions = [5, 4, 3, 2, 1];

    const handleSortChange = (sortBy: "createdAt" | "rating" | "helpful") => {
        const currentOrder = filters.sortBy === sortBy ? filters.order : "desc";
        const newOrder = currentOrder === "desc" ? "asc" : "desc";

        onFiltersChange({
            ...filters,
            sortBy,
            order: sortBy === "createdAt" || sortBy === "helpful" ? newOrder : newOrder,
        });
    };

    const handleRatingFilter = (rating: number) => {
        onFiltersChange({
            ...filters,
            rating: filters.rating === rating ? undefined : rating,
            page: 1, // Reset to first page
        });
    };

    const handleVerifiedFilter = () => {
        onFiltersChange({
            ...filters,
            verified: filters.verified ? undefined : true,
            page: 1,
        });
    };

    const handleImagesFilter = () => {
        onFiltersChange({
            ...filters,
            withImages: filters.withImages ? undefined : true,
            page: 1,
        });
    };

    const clearFilters = () => {
        onFiltersChange({
            page: 1,
            limit: filters.limit || 10,
        });
    };

    const hasActiveFilters = !!(
        filters.rating ||
        filters.verified ||
        filters.withImages
    );

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            {/* Filters Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Filters & Sort</h3>
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        <X size={14} />
                        Clear
                    </button>
                )}
            </div>

            {/* Sort Options */}
            <div className="mb-4 pb-4 border-b border-gray-100">
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                    Sort by
                </label>
                <div className="flex flex-wrap gap-2">
                    {sortOptions.map((option) => {
                        const isActive = filters.sortBy === option.value;
                        const isDesc = isActive && filters.order === "desc";

                        return (
                            <button
                                key={option.value}
                                onClick={() => handleSortChange(option.value)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${isActive
                                        ? "bg-blue-50 border-blue-200 text-blue-700"
                                        : "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                {option.label}
                                {isActive && (
                                    <span className="ml-1">{isDesc ? "↓" : "↑"}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filter Options */}
            <div>
                <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className="w-full flex items-center justify-between text-xs font-medium text-gray-700 mb-2"
                >
                    <span>Filters</span>
                    <ChevronDown
                        size={16}
                        className={`transition-transform ${isFiltersOpen ? "rotate-180" : ""}`}
                    />
                </button>

                {isFiltersOpen && (
                    <div className="space-y-3 pt-2">
                        {/* Rating Filter */}
                        <div>
                            <label className="text-xs font-medium text-gray-700 mb-2 block">
                                Rating
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {ratingOptions.map((rating) => (
                                    <button
                                        key={rating}
                                        onClick={() => handleRatingFilter(rating)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filters.rating === rating
                                                ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                                : "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
                                            }`}
                                    >
                                        {rating} ★
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Verified Purchase Filter */}
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!filters.verified}
                                    onChange={handleVerifiedFilter}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">
                                    Verified Purchase Only
                                </span>
                            </label>
                        </div>

                        {/* With Images Filter */}
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!filters.withImages}
                                    onChange={handleImagesFilter}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">
                                    With Images Only
                                </span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Count */}
            {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                        Showing filtered results from {totalReviews} total reviews
                    </p>
                </div>
            )}
        </div>
    );
}

