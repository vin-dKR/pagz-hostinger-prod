/**
 * Orphan Payments Page
 *
 * Lists captured-but-not-persisted Razorpay payments and lets an admin
 * manually recover them. Surfaces the "Razorpay captured but no Order
 * in DB" failure class (transaction timeout, pool exhaustion, missed
 * webhook). Calls the api endpoints added in PR #105.
 */

import { OrphanPaymentsList } from '@/app/components/features/payments/orphan-payments-list';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function OrphanPaymentsPage() {
    return (
        <ManagementPage
            section="Commerce / Payments"
            title="Orphan payments"
            description="Review captured Razorpay payments without an order record and recover them using their gateway IDs."
        >
            <OrphanPaymentsList />
        </ManagementPage>
    );
}
