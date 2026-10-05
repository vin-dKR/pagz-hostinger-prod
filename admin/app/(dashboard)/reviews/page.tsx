/**
 * Reviews Management Page
 * Moderate product reviews
 */

import { ReviewsListEnhanced } from '@/app/components/features/reviews/reviews-list-enhanced';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function ReviewsPage() {
    return (
        <ManagementPage section="Content / Reviews" title="Reviews" description="Moderate feedback and keep your product reviews organized.">
            <ReviewsListEnhanced />
        </ManagementPage>
    );
}
