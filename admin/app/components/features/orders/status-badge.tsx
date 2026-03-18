/**
 * Status Badge Component
 * Displays order status with appropriate colors
 */

import { Badge } from '@/app/components/ui/badge';
import { type OrderStatus, type PaymentStatus } from '@/lib/api/orders.service';

export function OrderStatusBadge({ status, showCaret }: { status: OrderStatus; showCaret?: boolean }) {
    const variant = getStatusVariant(status);

    return (
        <Badge variant={variant} className={`capitalize ${showCaret ? 'gap-1' : ''}`}>
            <span>{status.replace(/_/g, ' ').toLowerCase()}</span>
            {showCaret && (
                <svg
                    className="w-3 h-3 opacity-90 pointer-events-none"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    {/* Inverted dropdown triangle (pointing down) */}
                    <path d="M5 7l5 6 5-6H5z" />
                </svg>
            )}
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

