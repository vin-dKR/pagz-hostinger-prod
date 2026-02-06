'use client';

/**
 * Select Component
 * Apple-inspired select dropdown with consistent styling
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <select
                ref={ref}
                className={cn(
                    'flex h-10 w-full rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:border-[var(--color-primary)]',
                    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-muted)]',
                    'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23666\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75rem_center] bg-[length:12px_12px] pr-8',
                    className
                )}
                {...props}
            >
                {children}
            </select>
        );
    }
);
Select.displayName = 'Select';

