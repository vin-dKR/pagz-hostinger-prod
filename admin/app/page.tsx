/**
 * Root Page
 * Redirects to dashboard or login based on authentication
 */

import { RootRedirect } from '@/app/components/features/auth/root-redirect';

export default function RootPage() {
  return <RootRedirect />;
}

