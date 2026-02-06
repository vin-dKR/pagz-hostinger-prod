interface ProductRatingProps {
    rating: number;
    showText?: boolean;
    reviewCount?: number;
}

export default function ProductRating({ rating, showText = true, reviewCount }: ProductRatingProps) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => {
                    if (index < fullStars) {
                        return (
                            <svg
                                key={index}
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="text-yellow-400"
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        );
                    } else if (index === fullStars && hasHalfStar) {
                        return (
                            <svg
                                key={index}
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-yellow-400"
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        );
                    } else {
                        return (
                            <svg
                                key={index}
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-gray-300"
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        );
                    }
                })}
            </div>
            {showText && (
                <span className="text-sm text-gray-600">
                    {rating}/5{reviewCount !== undefined && ` (${reviewCount} reviews)`}
                </span>
            )}
        </div>
    );
}
