/**
 * Payments Management Page
 * View all payment transactions
 */

import { PaymentsList } from '@/app/components/features/payments/payments-list';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function PaymentsPage() {
    return (
        <ManagementPage section="Commerce / Payments" title="Payments" description="Review transactions, payment status, and refunds.">
            <PaymentsList />
        </ManagementPage>
    );
}
