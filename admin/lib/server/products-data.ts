import 'server-only';

import { cookies } from 'next/headers';
import type { Product } from '../api/products.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single product by ID.
 */
export async function getProduct(id: string): Promise<Product | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/products/${id}`, {
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
        console.error('[Products] Error fetching product:', error);
        return null;
    }
}

