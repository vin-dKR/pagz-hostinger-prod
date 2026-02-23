import 'server-only';

import { cookies } from 'next/headers';
import type { Payment } from '../api/payments.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single payment by ID.
 */
export async function getPayment(id: string): Promise<Payment | null> {
    const cookieStore = await cookies();
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
            return null;
        }

        const body = await res.json();
        return body.data || body;
    } catch (error) {
        console.error('[Payments] Error fetching payment:', error);
        return null;
    }
}
