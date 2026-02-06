/**
 * User Detail Page
 * Comprehensive user management page
 */

import { UserDetail } from '@/app/components/features/users/user-detail';
import { getUser } from '@/lib/server/users-data';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getUser(id);
    return <UserDetail userId={id} initialUser={user || undefined} />;
}

