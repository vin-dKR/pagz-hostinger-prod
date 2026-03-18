import 'server-only';

import { cookies } from 'next/headers';
import type { Review } from '../api/reviews.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single review by ID.
 */
export async function getReview(id: string): Promise<Review | null> {
    try {
        let cookieStore;
        try {
            cookieStore = await cookies();
        } catch (cookieError) {
            console.error('[Reviews] Error accessing cookies:', cookieError);
            return null;
        }

    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/reviews/${id}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
                // Handle 401 Unauthorized (session expired/invalid)
                if (res.status === 401) {
                    console.error('[Reviews] Session expired or invalid (401). User needs to login again.');
                    return null;
                }

                console.error(`[Reviews] API returned ${res.status} for review ${id}`);
                return null;
            }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[Reviews] Error parsing JSON response:', jsonError);
            return null;
        }

        return body.data || body;
        } catch (fetchError) {
            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[Reviews] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[Reviews] Unexpected error fetching review:', error);
        return null;
    }
}

