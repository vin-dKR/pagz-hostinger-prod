"use client";

import { useState } from "react";
import Image from "next/image";
import { imageLoader } from "@/lib/utils/image-loader";
import { Star, ThumbsUp, Image as ImageIcon, BadgeCheck, X } from "lucide-react";
import { Review } from "@/lib/api/reviews";
// Format date helper
function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
}

interface ReviewCardProps {
    review: Review;
    onHelpfulClick?: (reviewId: string, isHelpful: boolean) => void;
    hasVoted?: boolean;
    userVote?: boolean;
}

export default function ReviewCard({
    review,
    onHelpfulClick,
    hasVoted = false,
    userVote = false,
}: ReviewCardProps) {
    const [imageViewer, setImageViewer] = useState<{ images: string[]; index: number } | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const userName = review.user?.name || "Anonymous";
    const userInitial = userName.charAt(0).toUpperCase();
    const reviewDate = formatDate(review.createdAt);

    const handleImageClick = (index: number) => {
        if (review.images && review.images.length > 0) {
            setImageViewer({ images: review.images, index });
        }
    };

    const handleHelpfulClick = () => {
        if (onHelpfulClick && !hasVoted) {
            onHelpfulClick(review.id, !userVote);
        }
    };

    return (
        <>
            <div className="border border-gray-100 rounded-xl p-4 md:p-5 hover:border-gray-200 transition-all duration-200 hover:shadow-sm bg-white">
                {/* Review Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                        {/* User Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center font-semibold text-blue-600 shrink-0">
                            {userInitial}
                        </div>

                        {/* User Info & Rating */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col gap-1 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900 truncate">
                                        {userName}
                                    </span>
                                    {review.isVerifiedPurchase && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                            <BadgeCheck size={12} className="fill-current" />
                                            Verified Purchase
                                        </span>
                                    )}
                                </div>

                                {/* Star Rating */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                size={16}
                                                className={i < review.rating
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-gray-300"
                                                }
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {reviewDate}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Review Title */}
                {review.title && (
                    <h4 className="font-semibold text-gray-900 mb-2 text-base md:text-lg">
                        {review.title}
                    </h4>
                )}

                {/* Review Comment */}
                {review.comment && (
                    <p
                        className={`text-gray-700 leading-relaxed mb-4 text-sm md:text-base ${!isExpanded && review.comment.length > 200 ? "line-clamp-3" : ""
                            }`}
                    >
                        {review.comment}
                    </p>
                )}

                {/* Show More/Less */}
                {review.comment && review.comment.length > 200 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 cursor-pointer"
                    >
                        {isExpanded ? "Show less" : "Show more"}
                    </button>
                )}

                {/* Review Images */}
                {review.images && review.images.length > 0 && (
                    <div className="mb-4">
                        <div className="grid grid-cols-3 gap-2">
                            {review.images.slice(0, 3).map((image, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleImageClick(index)}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors group"
                                >
                                    <Image
                                        src={image}
                                        alt={`Review image ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 33vw, 150px"
                                        loader={imageLoader}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <ImageIcon size={20} className="text-white opacity-0 group-hover:opacity-100" />
                                    </div>
                                    {index === 2 && review.images!.length > 3 && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <span className="text-white font-medium text-sm">
                                                +{review.images.length - 3}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Helpful & Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button
                        onClick={handleHelpfulClick}
                        disabled={hasVoted}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${hasVoted && userVote
                            ? "text-blue-600 font-medium"
                            : hasVoted
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-gray-600 hover:text-blue-600 cursor-pointer"
                            }`}
                    >
                        <ThumbsUp
                            size={16}
                            className={hasVoted && userVote ? "fill-current" : ""}
                        />
                        <span>
                            Helpful ({review.isHelpful || 0})
                        </span>
                    </button>
                </div>
            </div>

            {/* Image Viewer Modal */}
            {imageViewer && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setImageViewer(null)}
                >
                    <div className="relative max-w-4xl max-h-full w-full">
                        <button
                            onClick={() => setImageViewer(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2"
                        >
                            <X size={24} />
                        </button>

                        <div className="relative w-full max-w-4xl max-h-[90vh] aspect-square mx-auto">
                            <Image
                                src={imageViewer.images[imageViewer.index] || ""}
                                alt={`Review image ${imageViewer.index + 1}`}
                                fill
                                loader={imageLoader}
                                className="object-contain rounded-lg"
                                sizes="100vw"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        {imageViewer.images.length > 1 && (
                            <>
                                {imageViewer.index > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImageViewer({
                                                ...imageViewer,
                                                index: imageViewer.index - 1
                                            });
                                        }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
                                    >
                                        ←
                                    </button>
                                )}
                                {imageViewer.index < imageViewer.images.length - 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImageViewer({
                                                ...imageViewer,
                                                index: imageViewer.index + 1
                                            });
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
                                    >
                                        →
                                    </button>
                                )}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                                    {imageViewer.index + 1} / {imageViewer.images.length}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

