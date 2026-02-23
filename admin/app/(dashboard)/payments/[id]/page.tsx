/**
 * Payment Detail Page
 * View and manage individual payment
 */

import { PaymentDetail } from '@/app/components/features/payments/payment-detail';
import { getPayment } from '@/lib/server/payments-data';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const payment = await getPayment(id);
    return <PaymentDetail paymentId={id} initialPayment={payment || undefined} />;
}
