/**
 * Authentication API functions (Phone + OTP via Fast2SMS)
 */

import { post, get, put, del, ApiResponse } from '../api-client';

export type OtpPurpose = 'SIGNUP' | 'RESET_PASSWORD';

export interface LoginCredentials {
  phone?: string;
  email?: string;
  password: string;
}

export interface RegisterData {
  phone: string;
  password: string;
  otp: string;
  name: string;
  email?: string;
}

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  name?: string | null;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  createdAt: string;
  updatedAt?: string;
  addresses?: any[];
  notificationPreferences?: Record<string, boolean>;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UpdateProfileData {
  name?: string;
  email?: string | null;
}

export interface NotificationPreferences {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  orderUpdates?: boolean;
  promotions?: boolean;
  newsletters?: boolean;
}

export interface SendOtpResponse {
  phone: string;
  expiresInMinutes: number;
}

export interface ForgotPasswordResponse {
  phone?: string;
  requiresSignup?: boolean;
  message?: string;
  expiresInMinutes?: number;
}

/**
 * Send OTP to phone for signup or password reset.
 */
export async function sendOtp(phone: string, purpose: OtpPurpose): Promise<ApiResponse<SendOtpResponse>> {
  return post<SendOtpResponse>('/auth/send-otp', { phone, purpose });
}

/**
 * Register a new user (requires OTP from prior send-otp with purpose=SIGNUP).
 */
export async function register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>('/auth/register', data);
}

/**
 * Login with phone (customer) or email (admin) + password.
 */
export async function login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>('/auth/login', credentials);
}

export async function getProfile(): Promise<ApiResponse<User>> {
  return get<User>('/auth/user/profile');
}

export async function updateProfile(data: UpdateProfileData): Promise<ApiResponse<User>> {
  return put<User>('/auth/user/profile', data);
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
  return put<void>('/auth/user/password', { currentPassword, newPassword });
}

export async function updateNotificationPreferences(preferences: NotificationPreferences): Promise<ApiResponse<User>> {
  return put<User>('/auth/user/notifications', { preferences });
}

export async function deleteAccount(): Promise<ApiResponse<void>> {
  return del<void>('/auth/user/account');
}

/**
 * Request password reset OTP via SMS.
 */
export async function forgotPassword(phone: string): Promise<ApiResponse<ForgotPasswordResponse>> {
  return post<ForgotPasswordResponse>('/auth/forgot-password', { phone });
}

export async function verifyOTP(phone: string, otp: string, purpose: OtpPurpose = 'RESET_PASSWORD'): Promise<ApiResponse<{ valid: boolean }>> {
  return post<{ valid: boolean }>('/auth/verify-otp', { phone, otp, purpose });
}

export async function resetPassword(phone: string, otp: string, password: string): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>('/auth/reset-password', { phone, otp, password });
}
