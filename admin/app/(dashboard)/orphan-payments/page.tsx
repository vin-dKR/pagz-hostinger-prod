/**
 * Orphan Payments Page
 *
 * Lists captured-but-not-persisted Razorpay payments and lets an admin
 * manually recover them. Surfaces the "Razorpay captured but no Order
 * in DB" failure class (transaction timeout, pool exhaustion, missed
 * webhook). Calls the api endpoints added in PR #105.
 */

import { OrphanPaymentsList } from '@/app/components/features/payments/orphan-payments-list';

export default function OrphanPaymentsPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">
                    Orphan Payments
                </h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    Payments captured by Razorpay where no Order was written.
                    Recover by supplying the gateway ids from the Razorpay
                    dashboard.
                </p>
            </div>

            <OrphanPaymentsList />
        </div>
    );
}
