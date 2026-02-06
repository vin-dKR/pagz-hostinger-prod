'use client';

/**
 * Root Redirect Component
 * Redirects to dashboard if logged in, otherwise to login
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/api/api-client';

export function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();

    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}

