import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, value, ...props }, ref) => {
        // Ensure value is always a string when provided to prevent "uncontrolled to controlled" warnings
        // If value prop is provided (not undefined), convert null to empty string to keep it controlled
        // If value is undefined, don't pass it (keeps input uncontrolled)
        const inputProps = value !== undefined
            ? { ...props, value: value !== null ? String(value) : '' }
            : props;

        return (
            <input
                type={type}
                className={cn(
                    'flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-input)] bg-[#f7f7f7] px-3 py-2 text-[13px] text-[var(--color-foreground)] shadow-[inset_0_1px_2px_#00000006,0_1px_0_#ffffff] transition-[border-color,box-shadow] duration-150',
                    'placeholder:text-[var(--color-foreground-tertiary)]',
                    'focus-visible:border-[#aaaaca] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6e6ed]',
                    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-muted)]',
                    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                    className
                )}
                ref={ref}
                {...inputProps}
            />
        );
    }
);
Input.displayName = 'Input';

export { Input };
