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
            default: 'bg-[#efeff7] text-[#6463a4]',
            secondary: 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
            destructive: 'bg-[#fdf0ef] text-[#b83e3e]',
            outline: 'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground-secondary)]',
            success: 'bg-[#e9f6f0] text-[#217659]',
            warning: 'bg-[#fff5e8] text-[#9a6217]',
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'inline-flex items-center whitespace-nowrap rounded-[5px] px-2 py-1 text-[11px] font-medium leading-none tracking-[-0.01em] transition-colors',
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
