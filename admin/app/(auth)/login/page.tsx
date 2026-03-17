/**
 * Admin Login Page
 * Server Component for login page
 */

import { LoginForm } from '@/app/components/features/auth/login-form';
import { AuthGuard } from '@/app/components/features/auth/auth-guard';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to manage your e-print store
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </AuthGuard>
  );
}

