'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import { User } from '@/lib/api/users.service';
import { UserSecurityActions } from './user-security-actions';
import { UserCommunication } from './user-communication';

interface UserProfileProps {
    userId: string;
    user: User & { statistics?: any };
}

export function UserProfile({ user }: UserProfileProps) {
    const metrics = user.statistics ? [
        { label: 'Total orders', value: user.statistics.totalOrders },
        { label: 'Total spent', value: `₹${user.statistics.totalSpent.toLocaleString()}` },
        { label: 'Average order value', value: `₹${user.statistics.avgOrderValue?.toLocaleString() || '0'}` },
        { label: 'Total reviews', value: user.statistics.totalReviews },
        { label: 'Addresses', value: user.statistics.addressesCount },
        { label: 'Wishlist items', value: user.statistics.wishlistItemsCount },
        { label: 'Cart items', value: user.statistics.cartItemsCount },
        { label: 'Account age', value: `${user.statistics.accountAge || 0} days` },
    ] : [];

    return (
        <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                <Card>
                    <CardContent className="p-5 sm:p-6">
                        <div className="mb-5 border-b border-[var(--color-border)] pb-4">
                            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Account details</h2>
                            <p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">Profile and registration information</p>
                        </div>
                        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Full name</dt><dd className="mt-1 break-words text-sm font-medium text-[var(--color-foreground)]">{user.name || 'N/A'}</dd></div>
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Email</dt><dd className="mt-1 break-all text-sm font-medium"><a href={`mailto:${user.email}`} className="text-[var(--color-primary)] hover:underline">{user.email}</a></dd></div>
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Phone</dt><dd className="mt-1 text-sm font-medium">{user.phone ? <a href={`tel:${user.phone}`} className="text-[var(--color-primary)] hover:underline">{user.phone}</a> : <span className="text-[var(--color-foreground-tertiary)]">N/A</span>}</dd></div>
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Role</dt><dd className="mt-1">{user.isSuperAdmin ? <Badge variant="destructive">Super Admin</Badge> : user.isAdmin ? <Badge variant="default">Admin</Badge> : <Badge variant="secondary">Customer</Badge>}</dd></div>
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Registration date</dt><dd className="mt-1 text-sm font-medium text-[var(--color-foreground)]">{formatDate(user.createdAt)}</dd></div>
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Last updated</dt><dd className="mt-1 text-sm font-medium text-[var(--color-foreground)]">{formatDate(user.updatedAt)}</dd></div>
                            <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">User ID</dt><dd className="mt-1 break-all font-mono text-xs text-[var(--color-foreground-secondary)]">{user.id}</dd></div>
                            {user.supabaseId && <div><dt className="text-xs text-[var(--color-foreground-tertiary)]">Supabase ID</dt><dd className="mt-1 break-all font-mono text-xs text-[var(--color-foreground-secondary)]">{user.supabaseId}</dd></div>}
                        </dl>
                    </CardContent>
                </Card>
                {user.statistics && (
                    <Card>
                        <CardContent className="p-5 sm:p-6">
                            <div className="mb-5 border-b border-[var(--color-border)] pb-4"><h2 className="text-sm font-semibold text-[var(--color-foreground)]">Recent activity</h2><p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">Latest order and review dates</p></div>
                            <dl className="space-y-5">
                                <div className="flex items-center justify-between gap-3"><dt className="text-sm text-[var(--color-foreground-secondary)]">Last order</dt><dd className="text-sm font-medium text-[var(--color-foreground)]">{user.statistics.lastOrderDate ? formatDate(user.statistics.lastOrderDate) : 'Never'}</dd></div>
                                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5"><dt className="text-sm text-[var(--color-foreground-secondary)]">Last review</dt><dd className="text-sm font-medium text-[var(--color-foreground)]">{user.statistics.lastReviewDate ? formatDate(user.statistics.lastReviewDate) : 'Never'}</dd></div>
                            </dl>
                        </CardContent>
                    </Card>
                )}
            </div>

            {user.statistics && (
                <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
                    <div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-[var(--color-foreground)]">Customer activity</h2></div>
                    <div className="grid grid-cols-2 sm:grid-cols-4">
                        {metrics.map((metric) => <div key={metric.label} className="min-w-0 border-b border-r border-[var(--color-border)] px-4 py-4 sm:px-5"><p className="truncate text-xs text-[var(--color-foreground-tertiary)]">{metric.label}</p><p className="mt-2 truncate text-lg font-semibold tracking-tight tabular-nums text-[var(--color-foreground)]">{metric.value}</p></div>)}
                    </div>
                </section>
            )}

            <Card>
                <CardContent className="p-5 sm:p-6">
                    <div className="mb-5 border-b border-[var(--color-border)] pb-4"><h2 className="text-sm font-semibold text-[var(--color-foreground)]">Security & account management</h2><p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">Existing account controls and access settings</p></div>
                    <UserSecurityActions userId={user.id} userName={user.name || user.email} isSuspended={user.notificationPreferences && (user.notificationPreferences as any)?.suspension?.isSuspended} onSuccess={() => { window.location.reload(); }} />
                </CardContent>
            </Card>

            <UserCommunication userId={user.id} user={user} onSuccess={() => { window.location.reload(); }} />
        </div>
    );
}
