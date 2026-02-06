import 'server-only';

import { cookies } from 'next/headers';
import type { Order } from '../api/orders.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single order by ID.
 */
export async function getOrder(id: string): Promise<Order | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/orders/${id}`, {
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
        console.error('[Orders] Error fetching order:', error);
        return null;
    }
}

