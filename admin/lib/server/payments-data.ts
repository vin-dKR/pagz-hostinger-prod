import 'server-only';

import type { Payment } from '../api/payments.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single payment by ID.
 */
export async function getPayment(id: string): Promise<Payment | null> {
    try {
    try {
        const res = await fetch(`${baseUrl}/admin/payments/${id}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
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
