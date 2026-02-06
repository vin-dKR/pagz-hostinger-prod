/**
 * API Client - Centralized API communication layer for Admin Panel
 * Handles all HTTP requests to the backend API with proper error handling
 */

import { toastError } from '../utils/toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

export interface ApiError {
    message: string;
    statusCode?: number;
    errors?: Record<string, string[]>;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * Decode JWT token to get payload (without verification)
 */
function decodeToken(token: string): { userId?: string; email?: string; type?: string; exp?: number; iat?: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null; // Invalid JWT format
        }
        const base64Url = parts[1];
        if (!base64Url) {
            return null;
        }
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('[AUTH] Failed to decode token:', error);
        return null;
    }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return true; // If we can't decode or no exp, consider it expired
    }
    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    return currentTime >= expirationTime;
}

/**
 * Get authentication token from cookies (server-side compatible)
 */
export function getAuthToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('admin_token='));

    if (!tokenCookie) {
        return null;
    }

    const token = tokenCookie.split('=')[1]?.trim() || null;

    // Check if token is expired
    if (token && isTokenExpired(token)) {
        console.warn('[AUTH] Token is expired, clearing it');
        setAuthToken(undefined);
        return null;
    }

    return token;
}

/**
 * Set authentication token in cookies
 */
export function setAuthToken(token: string | undefined): void {
    if (typeof window === 'undefined') {
        return;
    }

    if (token) {
        // Store token in cookie with 7 day expiration
        const expires = new Date();
        expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
        document.cookie = `admin_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } else {
        document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = getAuthToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Log admin API calls with unique prefix for easy grepping
    if (endpoint.startsWith('/admin/')) {

        const isExpired = token ? isTokenExpired(token) : true;

        // Warn if using expired token
        if (token && isExpired) {
            console.error('[AUTH_WARNING] Making API call with expired token! This will likely fail.');
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Non-JSON response (might be HTML error page)
            const text = await response.text();
            data = {
                error: text || 'An error occurred',
                message: `Server returned ${response.status}: ${response.statusText}`,
            };
        }

        if (!response.ok) {
            const errorMessage = data.message || data.error || 'An error occurred';
            const error: ApiError = {
                message: errorMessage,
                statusCode: response.status,
                errors: data.errors,
            };

            // Handle 401 Unauthorized errors
            if (response.status === 401) {
                const authEndpoints = ['/admin/auth/verify', '/admin/auth/profile', '/admin/auth/me'];
                const isAuthEndpoint = authEndpoints.some(authPath => endpoint.includes(authPath))

                // Check if this is an actual authentication error or an API error
                const isAuthError = errorMessage.toLowerCase().includes('token') ||
                    errorMessage.toLowerCase().includes('session') ||
                    errorMessage.toLowerCase().includes('expired') ||
                    errorMessage.toLowerCase().includes('login') ||
                    errorMessage.toLowerCase().includes('unauthorized') ||
                    errorMessage.toLowerCase().includes('authentication');

                if (isAuthEndpoint || isAuthError) {
                    // This is a real authentication failure
                    console.error('[AUTH_ERROR] Authentication failed:', {
                        endpoint,
                        error: errorMessage,
                        isAuthEndpoint,
                        isAuthError,
                    });

                    setAuthToken(undefined);
                    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                        // Show user-friendly message before redirect
                        toastError('Session expired or invalid. Please login again.');
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 2000);
                    }
                } else {
                    // This might be an API error that returned 401, not an auth issue
                    console.error('[API_ERROR] API returned 401 but may not be auth issue:', {
                        endpoint,
                        error: errorMessage,
                        suggestion: 'Check if this is an actual API error or authentication failure',
                    });
                    // Don't clear token or redirect - let the error propagate so the UI can handle it
                }
            }

            throw error;
        }

        return data;
    } catch (error) {
        // Handle network errors
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw {
                message: 'Network error. Please check if the API server is running.',
                statusCode: 0,
            } as ApiError;
        }

        throw error as ApiError;
    }
}

/**
 * GET request
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return fetchAPI<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export async function post<T>(
    endpoint: string,
    body?: unknown
): Promise<ApiResponse<T>> {
    return fetchAPI<T>(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * PUT request
 */
export async function put<T>(
    endpoint: string,
    body?: unknown
): Promise<ApiResponse<T>> {
    return fetchAPI<T>(endpoint, {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * DELETE request
 */
export async function del<T>(
    endpoint: string
): Promise<ApiResponse<T>> {
    return fetchAPI<T>(endpoint, { method: 'DELETE' });
}

/**
 * PATCH request
 */
export async function patch<T>(
    endpoint: string,
    body?: unknown
): Promise<ApiResponse<T>> {
    return fetchAPI<T>(endpoint, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * Upload file (multipart/form-data)
 */
export async function uploadFile<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>
): Promise<ApiResponse<T>> {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });
    }

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData,
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = {
                error: text || 'An error occurred',
                message: `Server returned ${response.status}: ${response.statusText}`,
            };
        }

        if (!response.ok) {
            const errorMessage = data.message || data.error || 'An error occurred';
            const error: ApiError = {
                message: errorMessage,
                statusCode: response.status,
                errors: data.errors,
            };
            throw error;
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw {
                message: 'Network error. Please check if the API server is running.',
                statusCode: 0,
            } as ApiError;
        }
        throw error as ApiError;
    }
}

