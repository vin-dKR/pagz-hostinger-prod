'use client';

/**
 * Root Redirect Component
 * Redirects directly to the authentication-free dashboard.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
