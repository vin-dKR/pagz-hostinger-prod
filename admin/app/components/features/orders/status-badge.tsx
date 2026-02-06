/**
 * Status Badge Component
 * Displays order status with appropriate colors
 */

import { Badge } from '@/app/components/ui/badge';
import { type OrderStatus, type PaymentStatus } from '@/lib/api/orders.service';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
    const variant = getStatusVariant(status);

    return (
        <Badge variant={variant} className="capitalize">
            {status.replace(/_/g, ' ').toLowerCase()}
        </Badge>
    );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
    const variant = getPaymentStatusVariant(status);

    return (
        <Badge variant={variant} className="capitalize">
            {status.toLowerCase()}
        </Badge>
    );
}

function getStatusVariant(status: OrderStatus): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
    switch (status) {
        case 'DELIVERED':
            return 'success';
        case 'SHIPPED':
            return 'default';
        case 'PROCESSING':
            return 'warning';
        case 'ACCEPTED':
            return 'default';
        case 'PENDING_REVIEW':
            return 'warning';
        case 'REJECTED':
        case 'CANCELLED':
            return 'destructive';
        default:
            return 'secondary';
    }
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

