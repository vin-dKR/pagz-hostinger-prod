/**
 * Loading Components
 * Loading indicators with subtle styling
 */

import { cn } from '@/lib/utils/cn';

interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
    const sizes = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    return (
        <svg
            className={cn('animate-spin text-[var(--color-primary)]', sizes[size], className)}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

export function LoadingOverlay() {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-background)]/80 backdrop-blur-sm">
            <Spinner size="lg" />
        </div>
    );
}

export function PageLoading() {
    return (
        <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
            <Spinner size="lg" />
        </div>
    );
}

