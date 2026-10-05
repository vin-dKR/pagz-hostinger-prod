import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
    ({ className, ...props }, ref) => (
        <div className="relative w-full overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)]">
            <table
                ref={ref}
                className={cn('w-full caption-bottom text-[13px]', className)}
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
    <thead ref={ref} className={cn('bg-[#f7f7f7] [&_tr]:border-b [&_tr]:border-[var(--color-border)]', className)} {...props} />
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
            'border-b border-[#eeeeee] transition-colors duration-150 hover:bg-[#f8f8f8] data-[state=selected]:bg-[#f0f0f5]',
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
            'h-9 whitespace-nowrap px-4 text-left align-middle text-[11px] font-medium tracking-normal text-[var(--color-foreground-secondary)] [&:has([role=checkbox])]:pr-0',
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
    className={cn('px-4 py-3.5 align-middle text-[13px] text-[var(--color-foreground)] [&:has([role=checkbox])]:pr-0', className)}
        {...props}
    />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
