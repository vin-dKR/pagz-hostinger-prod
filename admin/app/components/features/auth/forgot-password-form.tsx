'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { OtpInput } from '@/app/components/ui/otp-input';
import { requestAdminPasswordReset, resetAdminPassword } from '@/lib/api/auth.service';

type Step = 'phone' | 'reset' | 'success';

function isValidIndianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(normalized);
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValidIndianPhone(phone)) {
      setError('Enter the 10-digit mobile number registered to your admin account.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await requestAdminPasswordReset(phone);
      if (!response.success) {
        setError(response.error || 'Unable to send a reset code.');
        return;
      }
      if (response.data?.requiresSignup) {
        setError('No account is registered with this mobile number.');
        return;
      }
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Enter the 6-digit code sent to your mobile number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await resetAdminPassword(phone, otp, password);
      if (!response.success) {
        setError(response.error || 'Unable to reset password.');
        return;
      }
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="space-y-6">
        <Alert variant="success">Your password has been reset. Sign in with your new password.</Alert>
        <Link
          href="/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] shadow-sm transition-all duration-200 hover:bg-[var(--color-primary-hover)] hover:shadow"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form onSubmit={handleResetSubmit} className="space-y-6">
        {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

        <p className="text-sm text-gray-600">Enter the code sent to +91 {phone} and choose a new password.</p>

        <div className="space-y-2">
          <Label>6-digit code</Label>
          <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your new password"
            minLength={6}
            required
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Reset password
        </Button>

        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => {
            setStep('phone');
            setOtp('');
            setError(null);
          }}
        >
          Use a different mobile number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handlePhoneSubmit} className="space-y-6">
      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="phone">Registered mobile number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit Indian mobile number"
          required
          autoFocus
        />
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Send reset code
      </Button>
    </form>
  );
}
