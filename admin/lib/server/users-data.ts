import 'server-only';

import { cookies } from 'next/headers';
import type { User } from '../api/users.service';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Server-side helper to fetch a single user by ID.
 */
export async function getUser(id: string): Promise<User | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    try {
        const res = await fetch(`${baseUrl}/admin/users/${id}`, {
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
        console.error('[Users] Error fetching user:', error);
        return null;
    }
}

