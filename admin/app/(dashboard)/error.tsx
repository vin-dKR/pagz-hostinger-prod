/**
 * Error Boundary for Dashboard Routes
 * Catches errors in dashboard pages
 */

'use client';

import { useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Alert } from '@/app/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-3">
            <h2 className="font-semibold">Dashboard Error</h2>
            <p className="mt-1 text-sm">{error.message || 'An error occurred in the dashboard'}</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={reset} variant="outline">
                Try again
              </Button>
              <Button onClick={() => router.push('/dashboard')} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    </div>
  );
}

