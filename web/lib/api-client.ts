/**
 * API Client - Centralized API communication layer
 * Handles all HTTP requests to the backend API
 */

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

function createApiClientError(message: string, statusCode = 0, errors?: Record<string, string[]>): Error & ApiError {
    const err = new Error(message) as Error & ApiError;
    err.statusCode = statusCode;
    err.errors = errors;
    return err;
}

import { getCookie, setCookie, removeCookie } from './cookies';

const AUTH_TOKEN_COOKIE = 'auth_token';
const LEGACY_AUTH_TOKEN_COOKIE = 'refreshToken';
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Get authentication token from cookies
 */
export function getAuthToken(): string | null {
    const token = getCookie(AUTH_TOKEN_COOKIE);
    if (token) return token;

    // Backward compatibility: some sessions still store bearer token in refreshToken cookie.
    const legacyToken = getCookie(LEGACY_AUTH_TOKEN_COOKIE);
    if (legacyToken) {
        setCookie(AUTH_TOKEN_COOKIE, legacyToken, 7);
        return legacyToken;
    }

    return null;
}

/**
 * Set authentication token in cookies
 */
export function setAuthToken(token: string | undefined): void {
    if (token) {
        // Store token in cookie with 7 day expiration
        setCookie(AUTH_TOKEN_COOKIE, token, 7);
        // Keep legacy cookie in sync so old sessions don't lose auth unexpectedly.
        setCookie(LEGACY_AUTH_TOKEN_COOKIE, token, 7);
    } else {
        removeCookie(AUTH_TOKEN_COOKIE);
        removeCookie(LEGACY_AUTH_TOKEN_COOKIE);
    }
}

/**
 * Decode JWT token and get expiration time
 */
function decodeToken(token: string): { exp: number } | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        return null;
    }
}

/**
 * Check if local JWT is close to expiry. Local tokens last 7 days; refresh 1 day before.
 */
function isTokenExpiringSoon(token: string): boolean {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    return timeUntilExpiry < 24 * 60 * 60;
}

async function refreshAuthToken(): Promise<string | null> {
    if (isRefreshing && refreshPromise) return refreshPromise;

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const token = getAuthToken();
            if (!token) return null;

            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (data.success && data.data?.token) {
                setAuthToken(data.data.token);
                return data.data.token;
            }
            return null;
        } catch (error) {
            console.error('[API Client] Token refresh failed:', error);
            return null;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

/**
 * Generic fetch wrapper with error handling and automatic token refresh
 */
async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
): Promise<ApiResponse<T>> {
    let token = getAuthToken();

    // Check if token is expiring soon and refresh it proactively
    if (token && isTokenExpiringSoon(token) && !endpoint.includes('/auth/refresh')) {
        const newToken = await refreshAuthToken();
        if (newToken) {
            token = newToken;
        }
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
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
            // Handle API error responses
            const error = createApiClientError(
                data.message || data.error || 'An error occurred',
                response.status,
                data.errors
            );

            // Handle 401 Unauthorized errors
            if (response.status === 401) {
                // Don't retry refresh endpoint or if we've already retried
                if (endpoint.includes('/auth/refresh') || retryCount > 0) {
                    // Clear token
                    setAuthToken(undefined);
                    // Only redirect if we're on a protected route (not public pages)
                    if (typeof window !== 'undefined') {
                        const publicRoutes = ['/', '/coupons', '/products', '/services', '/about', '/privacy', '/terms', '/shipping', '/return', '/refund'];
                        const isPublicRoute = publicRoutes.some(route => window.location.pathname === route || window.location.pathname.startsWith(route + '/'));
                        if (!isPublicRoute && !window.location.pathname.includes('/auth/login')) {
                            window.location.href = '/auth/login';
                        }
                    }
                    throw error;
                }

                // Try to refresh token and retry the request
                const newToken = await refreshAuthToken();
                if (newToken) {
                    // Retry the request with the new token
                    return fetchAPI<T>(endpoint, options, retryCount + 1);
                } else {
                    // Token refresh failed - clear token
                    setAuthToken(undefined);
                    // Only redirect if we're on a protected route (not public pages)
                    if (typeof window !== 'undefined') {
                        const publicRoutes = ['/', '/coupons', '/products', '/services', '/about', '/privacy', '/terms', '/shipping', '/return', '/refund'];
                        const isPublicRoute = publicRoutes.some(route => window.location.pathname === route || window.location.pathname.startsWith(route + '/'));
                        if (!isPublicRoute && !window.location.pathname.includes('/auth/login')) {
                            window.location.href = '/auth/login';
                        }
                    }
                    throw error;
                }
            }

            throw error;
        }

        return data;
    } catch (error) {
        // Handle network errors
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw createApiClientError('Network error. Please check if the API server is running.', 0);
        }

        // Re-throw API errors
        throw error as Error & ApiError;
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
export async function del<T>(endpoint: string): Promise<ApiResponse<T>> {
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
 * Used for file uploads that require FormData
 */
export async function uploadFile<T>(
    endpoint: string,
    files: File[],
    additionalData?: Record<string, string>
): Promise<ApiResponse<T>> {
    const formData = new FormData();

    // Append files
    files.forEach(file => {
        formData.append('files', file);
    });

    // Append additional form data
    if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });
    }

    let token = getAuthToken();

    // Check if token is expiring soon and refresh it proactively
    if (token && isTokenExpiringSoon(token) && !endpoint.includes('/auth/refresh')) {
        const newToken = await refreshAuthToken();
        if (newToken) {
            token = newToken;
        }
    }

    const headers: Record<string, string> = {};
    // IMPORTANT: Don't set Content-Type for FormData - browser will set it automatically with boundary
    // Setting it manually will break the multipart/form-data boundary
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData,
        });

        // Check if response is JSON before parsing
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
            const error = createApiClientError(
                data.message || data.error || 'An error occurred',
                response.status,
                data.errors
            );

            // Handle 401 Unauthorized errors
            if (response.status === 401) {
                const newToken = await refreshAuthToken();
                if (newToken) {
                    // Retry the request with the new token
                    headers['Authorization'] = `Bearer ${newToken}`;
                    const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
                        method: 'POST',
                        headers,
                        body: formData,
                    });
                    const retryData = await retryResponse.json();
                    if (!retryResponse.ok) {
                        throw error;
                    }
                    return retryData;
                } else {
                    setAuthToken(undefined);
                    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
                        window.location.href = '/auth/login';
                    }
                    throw error;
                }
            }

            throw error;
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw createApiClientError('Network error. Please check if the API server is running.', 0);
        }
        throw error as Error & ApiError;
    }
}

