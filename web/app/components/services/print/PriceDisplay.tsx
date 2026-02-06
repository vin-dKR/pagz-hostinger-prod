import React from 'react';
import { cn } from '../../../../lib/utils';

interface PriceDisplayProps {
    amount: number;
    currency?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
    amount,
    currency = '¥',
    size = 'lg',
    className,
}) => {
    const sizeClasses = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-3xl',
    };

    return (
        <div className={cn('flex items-baseline', className)}>
            <span className={cn('font-bold text-primary', sizeClasses[size])}>
                {currency}{amount.toFixed(2)}
            </span>
            {size === 'lg' && (
                <span className="text-sm text-muted-foreground ml-1">per page</span>
            )}
        </div>
    );
};
