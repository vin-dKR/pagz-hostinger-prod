/**
 * Global Error Boundary
 * Catches errors in the app
 */

'use client';

import { useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Alert } from '@/app/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to error reporting service
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="flex h-200 items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md">
                <Alert variant="error">
                    <AlertCircle className="h-4 w-4" />
                    <div className="ml-3">
                        <h2 className="font-semibold">Something went wrong!</h2>
                        <p className="mt-1 text-sm">{error.message || 'An unexpected error occurred'}</p>
                        <Button onClick={reset} className="mt-4" variant="outline">
                            Try again
                        </Button>
                    </div>
                </Alert>
            </div>
        </div>
    );
}

