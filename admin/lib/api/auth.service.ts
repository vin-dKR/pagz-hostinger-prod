/**
 * Admin Authentication Service
 * Email+password sign-in with phone-based password recovery.
 */

import { post, ApiResponse } from './api-client';

export interface AdminLoginCredentials {
  email?: string;
  phone?: string;
  password: string;
}

export interface AdminUser {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}

export interface AuthResponse {
  user: AdminUser;
  token: string;
}

export interface SendOtpResponse {
  phone: string;
  expiresInMinutes: number;
}

export interface ForgotPasswordResponse extends SendOtpResponse {
  requiresSignup: boolean;
}

/**
 * Login admin using email OR phone + password.
 */
export async function loginAdmin(credentials: AdminLoginCredentials): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/auth/login', credentials);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Login failed');
  }
  if (!response.data.user?.isAdmin) {
    throw new Error('Access denied. Admin privileges required.');
  }

  return response.data;
}

/** Request a password-reset OTP for an existing admin account. */
export async function requestAdminPasswordReset(phone: string): Promise<ApiResponse<ForgotPasswordResponse>> {
  return post<ForgotPasswordResponse>('/auth/forgot-password', { phone });
}

/** Reset an existing admin password after verifying its phone OTP. */
export async function resetAdminPassword(
  phone: string,
  otp: string,
  password: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>('/auth/reset-password', { phone, otp, password });
}

/**
 * Leave the dashboard. Authentication state is not persisted.
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/dashboard';
  }
}
