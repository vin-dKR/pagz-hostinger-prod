import 'server-only';

import { cookies } from 'next/headers';
import type { DashboardOverviewResponse } from '../api/dashboard.service';

/**
 * Server-side helper to fetch the admin dashboard overview.
 * Uses the admin_token cookie and calls the internal API endpoint.
 */
export async function getDashboardOverview(): Promise<DashboardOverviewResponse | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('admin_token')?.value;

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
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const res = await fetch(`${baseUrl}/admin/dashboard/overview`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unknown error');
            console.error(`[DASHBOARD] API returned ${res.status}:`, errorText);
            throw new Error(`Failed to load dashboard overview (${res.status}): ${errorText.substring(0, 100)}`);
        }

        const body = await res.json();

        if (body && typeof body === 'object') {
            // Our API typically wraps data in { success, data }
            if (body.data) {
                return body.data as DashboardOverviewResponse;
            }
        }

        return body as DashboardOverviewResponse;
    } catch (error) {
        console.error('[DASHBOARD] Error fetching dashboard overview:', error);
        // Return null instead of throwing to allow the page to render with loading states
        // The components will handle null data gracefully
        return null;
    }
}


