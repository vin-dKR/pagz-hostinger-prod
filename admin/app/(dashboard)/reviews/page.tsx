/**
 * Reviews Management Page
 * Moderate product reviews
 */

import { ReviewsListEnhanced } from '@/app/components/features/reviews/reviews-list-enhanced';

export default function ReviewsPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Reviews</h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    Moderate and manage product reviews
                </p>
            </div>

            <ReviewsListEnhanced />
        </div>
    );
}

