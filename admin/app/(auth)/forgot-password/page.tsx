import Link from 'next/link';
import { AuthGuard } from '@/app/components/features/auth/auth-guard';
import { ForgotPasswordForm } from '@/app/components/features/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Reset admin password</h1>
            <p className="mt-2 text-sm text-gray-600">We&apos;ll send a verification code to your registered mobile number.</p>
          </div>
          <ForgotPasswordForm />
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
