'use client';

/**
 * Admin Signup Form — phone+OTP required.
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { OtpInput } from '@/app/components/ui/otp-input';
import { setAuthToken } from '@/lib/api/api-client';
import { registerAdmin, sendAdminOtp } from '@/lib/api/auth.service';

type Step = 'details' | 'otp';

function isValidIndianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(normalized);
}

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetailsSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!isValidIndianPhone(formData.phone)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Invalid email format');
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await sendAdminOtp(formData.phone, 'SIGNUP');
      if (!response.success) {
        setError(response.error || 'Failed to send OTP');
        return;
      }
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const response = await registerAdmin({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        password: formData.password,
        otp,
      });

      setAuthToken(response.token);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-6">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <p className="text-sm text-gray-600">
          OTP sent to +91 {formData.phone}. Enter below to complete registration.
        </p>

        <div className="space-y-2">
          <Label>6-digit OTP *</Label>
          <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Verify & Create Account
        </Button>

        <button
          type="button"
          onClick={() => {
            setStep('details');
            setOtp('');
            setError(null);
          }}
          className="text-sm text-primary hover:underline"
        >
          ← Change details
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit} className="space-y-6">
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter your full name"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Mobile Number *</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          placeholder="10-digit Indian mobile"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email (Optional)</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Enter your email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Enter your password (min. 6 characters)"
          required
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password *</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          placeholder="Confirm your password"
          required
          minLength={6}
        />
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Send OTP
      </Button>
    </form>
  );
}
