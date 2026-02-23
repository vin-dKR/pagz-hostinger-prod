/**
 * Payment Status Badge Component
 * Displays payment status with appropriate colors
 */

import { Badge } from '@/app/components/ui/badge';
import { type PaymentStatus } from '@/lib/api/payments.service';

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
    const variant = getPaymentStatusVariant(status);

    return (
        <Badge variant={variant} className="capitalize">
            {status.toLowerCase()}
        </Badge>
    );
}

function getPaymentStatusVariant(status: PaymentStatus): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
    switch (status) {
        case 'SUCCESS':
            return 'success';
        case 'PENDING':
            return 'warning';
        case 'FAILED':
            return 'destructive';
        case 'REFUNDED':
            return 'secondary';
        default:
            return 'secondary';
    }
}
