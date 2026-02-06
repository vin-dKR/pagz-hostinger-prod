/**
 * Table Components
 * Apple-inspired table with clean, minimal styling
 */

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
    ({ className, ...props }, ref) => (
        <div className="relative w-full overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
            <table
                ref={ref}
                className={cn('w-full caption-bottom text-sm', className)}
                {...props}
            />
        </div>
    )
);
Table.displayName = 'Table';

const TableHeader = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b border-[var(--color-border)]', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
    />
));
TableBody.displayName = 'TableBody';

const TableRow = forwardRef<
    HTMLTableRowElement,
    HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn(
            'border-b border-[var(--color-border)] transition-colors duration-150 hover:bg-[var(--color-accent)] data-[state=selected]:bg-[var(--color-accent)]',
            className
        )}
        {...props}
    />
));
TableRow.displayName = 'TableRow';

const TableHead = forwardRef<
    HTMLTableCellElement,
    HTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            'h-12 px-4 text-left align-middle text-xs font-semibold text-[var(--color-foreground-secondary)] uppercase tracking-wider [&:has([role=checkbox])]:pr-0',
            className
        )}
        {...props}
    />
));
TableHead.displayName = 'TableHead';

const TableCell = forwardRef<
    HTMLTableCellElement,
    HTMLAttributes<HTMLTableCellElement> & { colSpan?: number }
>(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn('p-4 align-middle text-sm text-[var(--color-foreground)] [&:has([role=checkbox])]:pr-0', className)}
        {...props}
    />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };

