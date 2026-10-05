'use client';

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
                    'flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-[13px] text-[var(--color-foreground)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150',
                    'focus-visible:border-[#aaaaca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6e6ed]',
                    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-muted)]',
                    'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'none\' stroke=\'%23667085\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m3 4.5 3 3 3-3\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75rem_center] bg-[length:12px_12px] pr-8',
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
