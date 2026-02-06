/**
 * Input Component
 * Apple-inspired input with subtle borders and smooth focus states
 */

import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { }

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
                    'flex h-10 w-full rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] transition-all duration-200',
                    'placeholder:text-[var(--color-foreground-tertiary)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:border-[var(--color-primary)]',
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

