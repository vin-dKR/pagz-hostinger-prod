/**
 * Reusable Coupon Status Badge Component
 * Displays coupon status with appropriate styling
 */

import { Badge } from './badge';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

interface CouponStatusBadgeProps {
    isActive: boolean;
    validFrom: string | Date;
    validUntil: string | Date;
    showIcon?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function CouponStatusBadge({
    isActive,
    validFrom,
    validUntil,
    showIcon = false,
    size = 'md',
}: CouponStatusBadgeProps) {
    const now = new Date();
    const from = new Date(validFrom);
    const until = new Date(validUntil);

    let status: 'active' | 'expired' | 'upcoming' | 'inactive';
    let label: string;
    let variant: 'success' | 'secondary' | 'warning' | 'destructive';
    let Icon: typeof CheckCircle2 | typeof XCircle | typeof Clock | typeof AlertCircle;

    if (!isActive) {
        status = 'inactive';
        label = 'Inactive';
        variant = 'secondary';
        Icon = XCircle;
    } else if (now > until) {
        status = 'expired';
        label = 'Expired';
        variant = 'secondary';
        Icon = XCircle;
    } else if (now < from) {
        status = 'upcoming';
        label = 'Upcoming';
        variant = 'warning';
        Icon = Clock;
    } else {
        status = 'active';
        label = 'Active';
        variant = 'success';
        Icon = CheckCircle2;
    }

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5',
    };

    return (
        <Badge variant={variant} className={`${sizeClasses[size]} flex items-center gap-1.5`}>
            {showIcon && <Icon className="h-3 w-3" />}
            {label}
        </Badge>
    );
}
