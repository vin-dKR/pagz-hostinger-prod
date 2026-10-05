/**
 * Users Management Page
 */

import { UsersList } from '@/app/components/features/users/users-list';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function UsersPage() {
    return (
        <ManagementPage section="Audience" title="Users" description="Understand your customers and manage their accounts.">
            <UsersList />
        </ManagementPage>
    );
}
