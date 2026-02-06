import 'server-only';

import { cookies } from 'next/headers';
import type { DashboardOverviewResponse } from '../api/dashboard.service';

/**
 * Server-side helper to fetch the admin dashboard overview.
 * Uses the admin_token cookie and calls the internal API endpoint.
 */
export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

    const res = await fetch(`${baseUrl}/admin/dashboard/overview`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Failed to load dashboard overview (${res.status})`);
    }

    const body = await res.json();

    if (body && typeof body === 'object') {
        // Our API typically wraps data in { success, data }
        if (body.data) {
            return body.data as DashboardOverviewResponse;
        }
    }

    return body as DashboardOverviewResponse;
}


