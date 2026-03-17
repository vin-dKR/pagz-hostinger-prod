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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const token = getAuthToken();

        if (!token) {
          // User is not logged in, redirect to login
          if (isMounted) {
            router.replace('/login');
          }
        } else {
          if (isMounted) {
            setIsChecking(false);
            setHasError(false);
          }
        }
      } catch (error) {
        console.error('[DashboardGuard] Error checking authentication:', error);
        if (isMounted) {
          setHasError(true);
          setIsChecking(false);
          // On error, redirect to login for safety
          router.replace('/login');
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Show loading while checking authentication
  if (isChecking) {
    return <PageLoading />;
  }

  // If there was an error, don't render children
  if (hasError) {
    return null;
  }

  // Check again in case token was removed
  try {
    const token = getAuthToken();
    if (!token) {
      return null; // Will redirect
    }
  } catch (error) {
    console.error('[DashboardGuard] Error getting token in render:', error);
    return null;
  }

  return <>{children}</>;
}

