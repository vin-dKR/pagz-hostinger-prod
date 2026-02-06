/**
 * User Statistics Dashboard Component
 * Displays overall user statistics
 */

'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { UserStatisticsResponse } from '@/lib/api/users.service';
import { Users, UserPlus, TrendingUp, DollarSign, Shield, UserCheck } from 'lucide-react';

interface UserStatsProps {
    statistics: UserStatisticsResponse;
}

export function UserStats({ statistics }: UserStatsProps) {
    const stats = [
        {
            label: 'Total Users',
            value: statistics.totalUsers.toLocaleString(),
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            label: 'New This Month',
            value: statistics.newUsersThisMonth.toLocaleString(),
            icon: UserPlus,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
        },
        {
            label: 'Active (30 days)',
            value: statistics.activeUsersLast30Days.toLocaleString(),
            icon: UserCheck,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
        },
        {
            label: 'Customers',
            value: statistics.totalCustomers.toLocaleString(),
            icon: Users,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
        },
        {
            label: 'Admins',
            value: statistics.totalAdmins.toLocaleString(),
            icon: Shield,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            label: 'Avg Lifetime Value',
            value: `₹${statistics.avgLifetimeValue.toLocaleString()}`,
            icon: DollarSign,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <Card key={index}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                </div>
                                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-full`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

