/**
 * Authentication Service
 * Handles admin authentication operations
 */

import { post } from './api-client';

export interface AdminLoginCredentials {
  email: string;
  password: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  isAdmin: boolean;
}

export interface AuthResponse {
  user: AdminUser;
  token: string;
}

/**
 * Login as admin
 */
export async function loginAdmin(credentials: AdminLoginCredentials): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/auth/login', credentials);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Login failed');
  }

  // Verify user is admin
  if (!response.data.user?.isAdmin) {
    throw new Error('Access denied. Admin privileges required.');
  }

  return response.data;
}

export interface AdminSignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface SignupResponse {
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    isAdmin: boolean;
  };
  token: string;
}

/**
 * Register new admin
 */
export async function registerAdmin(data: AdminSignupData): Promise<SignupResponse> {
  const response = await post<SignupResponse>('/auth/register', {
    ...data,
    isAdmin: true,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Registration failed');
  }

  return response.data;
}

/**
 * Logout admin (client-side only)
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    // Clear token
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/login';
  }
}

