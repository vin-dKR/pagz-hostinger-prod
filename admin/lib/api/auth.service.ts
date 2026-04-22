/**
 * Admin Authentication Service
 * Phone-based OTP signup, email+password login.
 */

import { post, ApiResponse } from './api-client';

export type OtpPurpose = 'SIGNUP' | 'RESET_PASSWORD';

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

export interface AdminSignupData {
  name: string;
  phone: string;
  otp: string;
  password: string;
  email?: string;
}

export interface SendOtpResponse {
  phone: string;
  expiresInMinutes: number;
}

/**
 * Send OTP to mobile (signup or reset).
 */
export async function sendAdminOtp(phone: string, purpose: OtpPurpose): Promise<ApiResponse<SendOtpResponse>> {
  return post<SendOtpResponse>('/auth/send-otp', { phone, purpose });
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

/**
 * Register admin. Requires OTP previously obtained with purpose=SIGNUP.
 */
export async function registerAdmin(data: AdminSignupData): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/auth/register', { ...data, isAdmin: true });

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Registration failed');
  }
  return response.data;
}

/**
 * Logout admin (client-side only).
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/login';
  }
}
