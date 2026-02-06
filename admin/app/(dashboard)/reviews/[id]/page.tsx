/**
 * Review Detail Page
 * View comprehensive review information
 */

import { ReviewDetail } from '@/app/components/features/reviews/review-detail';
import { getReview } from '@/lib/server/reviews-data';

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const review = await getReview(id);
    return <ReviewDetail reviewId={id} initialReview={review || undefined} />;
}

