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
        <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className={`${sizeClasses[size]} animate-spin text-gray-400 mb-2`} />
            <p className="text-sm text-gray-600">{message}</p>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
                {content}
            </div>
        );
    }

    return content;
}
