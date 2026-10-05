/**
 * Reusable Loading State Component
 */

import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
}

export function LoadingState({
    message = 'Loading...',
    size = 'md',
    fullScreen = false,
}: LoadingStateProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    const content = (
        <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className={`${sizeClasses[size]} mb-3 animate-spin text-[var(--color-primary)]`} />
            <p className="text-[13px] text-[var(--color-foreground-secondary)]">{message}</p>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-background)]/80 backdrop-blur-sm">
                {content}
            </div>
        );
    }

    return content;
}
