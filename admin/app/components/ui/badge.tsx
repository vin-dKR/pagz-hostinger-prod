/**
 * Badge Component
 */

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
            secondary: 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
            destructive: 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]',
            outline: 'text-[var(--color-foreground)] border border-[var(--color-border)] bg-transparent',
            success: 'bg-[var(--color-success)] text-[var(--color-success-foreground)]',
            warning: 'bg-[var(--color-warning)] text-[var(--color-warning-foreground)]',
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    variants[variant],
                    className
                )}
                {...props}
            />
        );
    }
);
Badge.displayName = 'Badge';

export { Badge };

