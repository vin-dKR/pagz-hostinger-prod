/**
 * API Client - Centralized API communication layer for Admin Panel
 * Handles all HTTP requests to the backend API with proper error handling
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

/**
 * Compatibility export for legacy callers. The admin dashboard no longer
 * authenticates requests, so it never reads cookies or returns a token.
 */
export function getAuthToken(): string | null {
    return null;
}

/** Compatibility no-op; tokens are no longer persisted by the admin app. */
export function setAuthToken(token: string | undefined): void {
    void token;
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        let data;

        try {
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
        } catch (parseError) {
            console.error('[API] Error parsing response:', parseError);
            data = {
                error: 'Failed to parse server response',
                message: `Server returned ${response.status}: ${response.statusText}`,
            };
        }

        if (!response.ok) {
            const errorMessage = data.message || data.error || 'An error occurred';
            const error = createApiClientError(errorMessage, response.status, data.errors);

            throw error;
        }

        return data;
    } catch (error) {
        // Handle network errors
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw createApiClientError('Network error. Please check if the API server is running.', 0);
        }

        // Handle AbortError (timeout, cancelled requests)
        if (error instanceof Error && error.name === 'AbortError') {
            throw createApiClientError('Request timeout. Please try again.', 0);
        }

        // Re-throw if it's already an ApiError
        if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error as ApiError;
        }

        // Wrap unknown errors
        throw createApiClientError(
            error instanceof Error ? error.message : 'An unexpected error occurred',
            0
        );
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
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });
    }

    const headers: Record<string, string> = {};

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData,
        });

        const contentType = response.headers.get('content-type');
        let data;

        try {
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = {
                error: text || 'An error occurred',
                    message: `Server returned ${response.status}: ${response.statusText}`,
                };
            }
        } catch (parseError) {
            console.error('[API] Error parsing file upload response:', parseError);
            data = {
                error: 'Failed to parse server response',
                message: `Server returned ${response.status}: ${response.statusText}`,
            };
        }

        if (!response.ok) {
            const errorMessage = data.message || data.error || 'An error occurred';
            const error = createApiClientError(errorMessage, response.status, data.errors);

            throw error;
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw createApiClientError('Network error. Please check if the API server is running.', 0);
        }

        if (error instanceof Error && error.name === 'AbortError') {
            throw createApiClientError('Upload timeout. Please try again.', 0);
        }

        if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error as ApiError;
        }

        throw createApiClientError(
            error instanceof Error ? error.message : 'An unexpected error occurred during file upload',
            0
        );
    }
}
