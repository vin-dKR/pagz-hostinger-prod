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
    const token = getAuthToken();

    if (token) {
      // User is already logged in, redirect to dashboard
      router.replace('/dashboard');
    }
  }, [router]);

  // Don't render children if user is logged in (will redirect)
  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  if (token) {
    return null; // Will redirect, so don't render
  }

  return <>{children}</>;
}

