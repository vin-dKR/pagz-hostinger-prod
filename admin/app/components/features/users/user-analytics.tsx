'use client';

import { UserStatisticsResponse } from '@/lib/api/users.service';

interface UserAnalyticsProps {
    statistics: UserStatisticsResponse;
}

export function UserAnalytics({ statistics }: UserAnalyticsProps) {
    const total = statistics.totalUsers || 1;
    const roles = [
        { label: 'Customers', count: statistics.totalCustomers, color: 'bg-[var(--color-primary)]' },
        { label: 'Admins', count: statistics.totalAdmins, color: 'bg-[var(--color-foreground-secondary)]' },
        { label: 'Super admins', count: statistics.totalSuperAdmins, color: 'bg-[var(--color-foreground-tertiary)]' },
    ];
    const signups = [
        { label: 'Today', value: statistics.newUsersToday },
        { label: 'This week', value: statistics.newUsersThisWeek },
        { label: 'This month', value: statistics.newUsersThisMonth },
    ];

    return (
        <section aria-label="User analytics" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="admin-panel">
                <div className="px-3 py-2.5">
                    <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Account composition</h2>
                    <p className="mt-0.5 text-xs text-[var(--color-foreground-secondary)]">How users are distributed across account roles</p>
                </div>
                <div className="admin-panel-interior p-4 sm:p-5">
                <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-[var(--color-background-tertiary)]" aria-hidden="true">
                    {roles.map((role) => <div key={role.label} className={role.color} style={{ width: `${(role.count / total) * 100}%` }} />)}
                </div>
                <div className="space-y-4">
                    {roles.map((role) => (
                        <div key={role.label} className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2.5 text-[var(--color-foreground-secondary)]"><span className={`h-2 w-2 rounded-full ${role.color}`} />{role.label}</span>
                            <span className="font-medium tabular-nums text-[var(--color-foreground)]">{role.count.toLocaleString()} <span className="ml-1 text-xs font-normal text-[var(--color-foreground-tertiary)]">({((role.count / total) * 100).toFixed(1)}%)</span></span>
                        </div>
                    ))}
                </div>
                </div>
            </div>

            <div className="admin-panel">
                <div className="px-3 py-2.5">
                    <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Recent registrations</h2>
                    <p className="mt-0.5 text-xs text-[var(--color-foreground-secondary)]">New accounts across the current periods</p>
                </div>
                <div className="admin-panel-interior p-4 sm:p-5">
                <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[#fafafa] py-4">
                    {signups.map((item) => (
                        <div key={item.label} className="min-w-0 px-3 text-center">
                            <p className="truncate text-[11px] text-[var(--color-foreground-secondary)]">{item.label}</p>
                            <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-[var(--color-foreground)]">{item.value.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[var(--color-border)] pt-5 text-xs">
                    <div><p className="text-[var(--color-foreground-tertiary)]">Active · 30 days</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{statistics.activeUsersLast30Days.toLocaleString()}</p></div>
                    <div><p className="text-[var(--color-foreground-tertiary)]">Avg. orders / user</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{statistics.avgOrdersPerUser.toFixed(2)}</p></div>
                    <div><p className="text-[var(--color-foreground-tertiary)]">Customers</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{statistics.totalCustomers.toLocaleString()}</p></div>
                    <div><p className="text-[var(--color-foreground-tertiary)]">Avg. lifetime value</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">₹{statistics.avgLifetimeValue.toFixed(2)}</p></div>
                </div>
                </div>
            </div>
        </section>
    );
}
