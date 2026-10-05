import 'server-only';

import type { DashboardOverviewResponse } from '../api/dashboard.service';

/**
 * Server-side helper to fetch the admin dashboard overview.
 * Calls the internal API endpoint without an authentication token.
 */
export async function getDashboardOverview(): Promise<DashboardOverviewResponse | null> {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

        // Warn if using localhost in production (likely means env var is not set)
        if (process.env.NODE_ENV === 'production' && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
            console.error('[DASHBOARD] ⚠️ CRITICAL: NEXT_PUBLIC_API_URL is not set or points to localhost in production!');
            console.error('[DASHBOARD] This will cause API calls to fail. Set NEXT_PUBLIC_API_URL to your production API URL.');
            console.error('[DASHBOARD] Example: NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1');
            // Return null instead of throwing to allow page to render with loading states
            return null;
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        let timeoutId: NodeJS.Timeout | null = null;

        try {
            timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const res = await fetch(`${baseUrl}/admin/dashboard/overview`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
            signal: controller.signal,
        });

            if (timeoutId) {
        clearTimeout(timeoutId);
                timeoutId = null;
            }

        if (!res.ok) {
                let errorText = 'Unknown error';
                try {
                    errorText = await res.text();
                } catch (textError) {
                    console.error('[DASHBOARD] Error reading error response:', textError);
                }

                console.error(`[DASHBOARD] API returned ${res.status}:`, errorText.substring(0, 200));
                
                // For other errors, return null to allow graceful degradation
                return null;
        }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[DASHBOARD] Error parsing JSON response:', jsonError);
                return null;
            }

        if (body && typeof body === 'object') {
            // Our API typically wraps data in { success, data }
            if (body.data) {
                return body.data as DashboardOverviewResponse;
            }
        }

        return body as DashboardOverviewResponse;
        } catch (fetchError) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Handle abort errors (timeout)
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error('[DASHBOARD] Request timeout');
                return null;
            }

            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[DASHBOARD] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[DASHBOARD] Unexpected error fetching dashboard overview:', error);
        // Return null instead of throwing to allow the page to render with loading states
        // The components will handle null data gracefully
        return null;
    }
}

