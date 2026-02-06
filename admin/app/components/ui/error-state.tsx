/**
 * Reusable Error State Component
 */

import { Alert } from './alert';
import { Button } from './button';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
}

export function ErrorState({
    title = 'Error',
    message,
    onRetry,
    retryLabel = 'Retry',
}: ErrorStateProps) {
    return (
        <Alert variant="error" className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
                <h3 className="font-medium mb-1">{title}</h3>
                <p className="text-sm">{message}</p>
                {onRetry && (
                    <Button onClick={onRetry} variant="outline" size="sm" className="mt-3">
                        {retryLabel}
                    </Button>
                )}
            </div>
        </Alert>
    );
}
