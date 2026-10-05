/**
 * Orders Page
 */

import { OrdersList } from '@/app/components/features/orders/orders-list';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function OrdersPage() {
    return (
        <ManagementPage section="Commerce / Orders" title="Orders" description="Manage customer orders and fulfillment in one place.">
            <OrdersList />
        </ManagementPage>
    );
}
