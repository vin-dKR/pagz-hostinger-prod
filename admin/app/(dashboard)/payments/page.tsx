/**
 * Payments Management Page
 * View all payment transactions
 */

import { PaymentsList } from '@/app/components/features/payments/payments-list';

export default function PaymentsPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Payments</h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    View and manage payment transactions
                </p>
            </div>

            <PaymentsList />
        </div>
    );
}

