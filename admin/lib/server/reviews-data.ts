import 'server-only';

import type { Review } from '../api/reviews.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single review by ID.
 */
export async function getReview(id: string): Promise<Review | null> {
    try {
    try {
        const res = await fetch(`${baseUrl}/admin/reviews/${id}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
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
