/**
 * Admin Signup Page
 * Server Component for admin registration page
 */

import { SignupForm } from '@/app/components/features/auth/signup-form';
import { AuthGuard } from '@/app/components/features/auth/auth-guard';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="mt-2 text-sm text-gray-600">
              Create an admin account to manage your e-print store
            </p>
          </div>
          <SignupForm />
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

