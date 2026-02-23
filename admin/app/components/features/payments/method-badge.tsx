/**
 * Payment Method Badge Component
 * Displays payment method with appropriate styling
 */

import { Badge } from '@/app/components/ui/badge';
import { type PaymentMethod } from '@/lib/api/payments.service';

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
    return (
        <Badge variant="outline" className="capitalize">
            {method.toLowerCase()}
        </Badge>
    );
}
