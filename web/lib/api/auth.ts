/**
 * Authentication API functions
 */

import { post, get, put, del, ApiResponse } from '../api-client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  supabaseId?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  createdAt: string;
  updatedAt?: string;
  addresses?: any[];
  notificationPreferences?: Record<string, boolean>;
}

export interface AuthResponse {
  user: User;
  token?: string; // Optional - may not be present if email confirmation is required
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
}

export interface NotificationPreferences {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  orderUpdates?: boolean;
  promotions?: boolean;
  newsletters?: boolean;
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>('/auth/register', data);
}

/**
 * Login user
 */
export async function login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
  return post<AuthResponse>('/auth/login', credentials);
}

/**
 * Get current user profile (requires authentication)
 */
export async function getProfile(): Promise<ApiResponse<User>> {
  return get<User>('/auth/user/profile');
}

/**
 * Update user profile (requires authentication)
 */
export async function updateProfile(data: UpdateProfileData): Promise<ApiResponse<User>> {
  return put<User>('/auth/user/profile', data);
}

/**
 * Update user password (requires authentication)
 */
export async function updatePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
  return put<void>('/auth/user/password', { currentPassword, newPassword });
}

/**
 * Update notification preferences (requires authentication)
 */
export async function updateNotificationPreferences(preferences: NotificationPreferences): Promise<ApiResponse<User>> {
  return put<User>('/auth/user/notifications', { preferences });
}

/**
 * Delete user account (requires authentication)
 */
export async function deleteAccount(): Promise<ApiResponse<void>> {
  return del<void>('/auth/user/account');
}

/**
 * Request password reset (forgot password)
 */
export async function forgotPassword(email: string): Promise<ApiResponse<{ message: string; requiresSignup?: boolean }>> {
  return post<{ message: string; requiresSignup?: boolean }>('/auth/forgot-password', { email });
}

/**
 * Verify OTP
 */
export async function verifyOTP(email: string, otp: string): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>('/auth/verify-otp', { email, otp });
}

/**
 * Reset password with OTP
 */
export async function resetPassword(email: string, otp: string, password: string): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>('/auth/reset-password', { email, otp, password });
}
