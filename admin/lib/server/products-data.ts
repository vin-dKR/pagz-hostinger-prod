import 'server-only';

import type { Product } from '../api/products.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single product by ID.
 */
export async function getProduct(id: string): Promise<Product | null> {
    try {
    try {
        const res = await fetch(`${baseUrl}/admin/products/${id}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
                console.error(`[Products] API returned ${res.status} for product ${id}`);
                return null;
            }

            let body;
            try {
                body = await res.json();
            } catch (jsonError) {
                console.error('[Products] Error parsing JSON response:', jsonError);
            return null;
        }

        return body.data || body;
        } catch (fetchError) {
            // Handle network errors
            if (fetchError instanceof TypeError) {
                console.error('[Products] Network error:', fetchError.message);
                return null;
            }

            throw fetchError;
        }
    } catch (error) {
        console.error('[Products] Unexpected error fetching product:', error);
        return null;
    }
}
