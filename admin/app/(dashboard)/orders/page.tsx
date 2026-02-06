/**
 * Orders Page
 */

import { OrdersList } from '@/app/components/features/orders/orders-list';

export default function OrdersPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Orders</h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    Manage customer orders
                </p>
            </div>

            <OrdersList />
        </div>
    );
}

