/**
 * Users Management Page
 */

import { UsersList } from '@/app/components/features/users/users-list';

export default function UsersPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Users</h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    Manage user accounts and permissions
                </p>
            </div>

            <UsersList />
        </div>
    );
}

