/**
 * Payment Format Utilities
 * Helper functions for formatting payment-related data
 */

import { type PaymentStatus } from '@/lib/api/payments.service';
import { formatCurrency } from './format';

/**
 * Format payment ID for display (truncate with ellipsis)
 */
export function formatPaymentId(id: string, length = 8): string {
    if (id.length <= length) return id;
    return `${id.slice(0, length)}...`;
}

/**
 * Format payment amount with discount
 */
export function formatPaymentAmount(amount: number, discount?: number): string {
    if (discount && discount > 0) {
        return `${formatCurrency(amount - discount)} (${formatCurrency(discount)} discount)`;
    }
    return formatCurrency(amount);
}

/**
 * Get payment status color
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
    switch (status) {
        case 'SUCCESS':
            return 'text-green-600';
        case 'PENDING':
            return 'text-yellow-600';
        case 'FAILED':
            return 'text-red-600';
        case 'REFUNDED':
            return 'text-gray-600';
        default:
            return 'text-gray-600';
    }
}
