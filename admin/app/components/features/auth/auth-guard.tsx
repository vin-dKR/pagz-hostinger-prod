'use client';

/**
 * Auth Guard Component
 * Redirects to dashboard if user is already logged in
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/api/api-client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const token = getAuthToken();

        if (token && isMounted) {
          // User is already logged in, redirect to dashboard
          router.replace('/dashboard');
        }
      } catch (error) {
        console.error('[AuthGuard] Error checking authentication:', error);
        // On error, allow the login page to render
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Don't render children if user is logged in (will redirect)
  try {
    const token = typeof window !== 'undefined' ? getAuthToken() : null;

    if (token) {
      return null; // Will redirect, so don't render
    }
  } catch (error) {
    console.error('[AuthGuard] Error getting token in render:', error);
    // On error, allow the login page to render
  }

  return <>{children}</>;
}

