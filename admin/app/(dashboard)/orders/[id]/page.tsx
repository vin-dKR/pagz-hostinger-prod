/**
 * Order Detail Page
 * View and manage individual order
 */

import { OrderDetail } from '@/app/components/features/orders/order-detail';
import { getOrder } from '@/lib/server/orders-data';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const order = await getOrder(id);
    return <OrderDetail orderId={id} initialOrder={order || undefined} />;
}

