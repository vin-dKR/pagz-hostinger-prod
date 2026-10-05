'use client';

import { UserStatisticsResponse } from '@/lib/api/users.service';
import { DollarSign, Shield, UserCheck, UserPlus, Users } from 'lucide-react';

interface UserStatsProps {
    statistics: UserStatisticsResponse;
}

export function UserStats({ statistics }: UserStatsProps) {
    const stats = [
        { label: 'Total users', value: statistics.totalUsers.toLocaleString(), icon: Users },
        { label: 'New this month', value: statistics.newUsersThisMonth.toLocaleString(), icon: UserPlus },
        { label: 'Active · 30 days', value: statistics.activeUsersLast30Days.toLocaleString(), icon: UserCheck },
        { label: 'Customers', value: statistics.totalCustomers.toLocaleString(), icon: Users },
        { label: 'Admins', value: statistics.totalAdmins.toLocaleString(), icon: Shield },
        { label: 'Avg. lifetime value', value: `₹${statistics.avgLifetimeValue.toLocaleString()}`, icon: DollarSign },
    ];

    return (
        <section aria-label="User metrics" className="admin-panel">
            <div className="admin-panel-interior grid grid-cols-2 gap-px bg-[var(--color-border)] md:grid-cols-3 xl:grid-cols-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="min-w-0 bg-[#f4f4f4] p-1">
                            <div className="flex min-h-7 items-center justify-between gap-2 px-3">
                                <p className="min-w-0 truncate text-[11px] font-medium text-[var(--color-foreground-secondary)]" title={stat.label}>{stat.label}</p>
                                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-foreground-tertiary)]" aria-hidden="true" />
                            </div>
                            <p className="truncate rounded-lg border border-[#e6e6e6] bg-white px-3 py-3 text-xl font-semibold tracking-tight tabular-nums text-[var(--color-foreground)] sm:text-2xl">{stat.value}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
