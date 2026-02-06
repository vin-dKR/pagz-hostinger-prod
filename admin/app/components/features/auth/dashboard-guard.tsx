'use client';

/**
 * Dashboard Guard Component
 * Redirects to login if user is not authenticated
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/api/api-client';
import { PageLoading } from '@/app/components/ui/loading';

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      // User is not logged in, redirect to login
      router.replace('/login');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Show loading while checking authentication
  if (isChecking) {
    return <PageLoading />;
  }

  // Check again in case token was removed
  const token = getAuthToken();
  if (!token) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

