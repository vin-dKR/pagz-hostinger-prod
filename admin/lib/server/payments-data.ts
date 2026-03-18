import 'server-only';

import { cookies } from 'next/headers';
import type { Payment } from '../api/payments.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single payment by ID.
 */
export async function getPayment(id: string): Promise<Payment | null> {
    try {
        let cookieStore;
        try {
            cookieStore = await cookies();
        } catch (cookieError) {
            console.error('[Payments] Error accessing cookies:', cookieError);
            return null;
        }

    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/payments/${id}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
                // Handle 401 Unauthorized (session expired/invalid)
                if (res.status === 401) {
                    console.error('[Payments] Session expired or invalid (401). User needs to login again.');
                    return null;
                }

                console.error(`[Payments] API returned ${res.status} for payment ${id}`);
                return null;
            }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[Payments] Error parsing JSON response:', jsonError);
            return null;
        }

        return body.data || body;
        } catch (fetchError) {
            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[Payments] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[Payments] Unexpected error fetching payment:', error);
        return null;
    }
}
