/**
 * User Analytics Component
 * Displays charts and visualizations for user statistics
 */

'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { UserStatisticsResponse } from '@/lib/api/users.service';

interface UserAnalyticsProps {
    statistics: UserStatisticsResponse;
}

export function UserAnalytics({ statistics }: UserAnalyticsProps) {
    // Calculate percentages for role distribution
    const total = statistics.totalUsers || 1;
    const customerPercent = (statistics.totalCustomers / total) * 100;
    const adminPercent = (statistics.totalAdmins / total) * 100;
    const superAdminPercent = (statistics.totalSuperAdmins / total) * 100;

    // Registration trend data (simplified - in production, fetch daily/weekly data)
    const registrationTrend = [
        { period: 'This Week', count: statistics.newUsersThisWeek },
        { period: 'This Month', count: statistics.newUsersThisMonth },
        { period: 'Total', count: statistics.totalUsers },
    ];

    const maxCount = Math.max(...registrationTrend.map(t => t.count), 1);

    return (
        <div className="space-y-6">
            {/* Role Distribution Chart */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">User Distribution by Role</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Customers</span>
                                <span className="text-sm text-gray-600">
                                    {statistics.totalCustomers} ({customerPercent.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                                <div
                                    className="bg-[#008ECC] h-4 rounded-full transition-all"
                                    style={{ width: `${customerPercent}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Admins</span>
                                <span className="text-sm text-gray-600">
                                    {statistics.totalAdmins} ({adminPercent.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                                <div
                                    className="bg-green-600 h-4 rounded-full transition-all"
                                    style={{ width: `${adminPercent}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Super Admins</span>
                                <span className="text-sm text-gray-600">
                                    {statistics.totalSuperAdmins} ({superAdminPercent.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                                <div
                                    className="bg-red-600 h-4 rounded-full transition-all"
                                    style={{ width: `${superAdminPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Registration Trend */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Registration Trend</h3>
                    <div className="space-y-4">
                        {registrationTrend.map((item, index) => (
                            <div key={index}>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">{item.period}</span>
                                    <span className="text-sm text-gray-600">{item.count} users</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-6">
                                    <div
                                        className="bg-indigo-600 h-6 rounded-full transition-all flex items-center justify-end pr-2"
                                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                                    >
                                        {item.count > 0 && (
                                            <span className="text-xs text-white font-medium">{item.count}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Engagement Metrics</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Active Users (30 days)</span>
                                <span className="text-sm font-semibold">{statistics.activeUsersLast30Days}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">New Users Today</span>
                                <span className="text-sm font-semibold">{statistics.newUsersToday}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">New Users This Week</span>
                                <span className="text-sm font-semibold">{statistics.newUsersThisWeek}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Business Metrics</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Average Orders per User</span>
                                <span className="text-sm font-semibold">
                                    {statistics.avgOrdersPerUser.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Average Lifetime Value</span>
                                <span className="text-sm font-semibold">
                                    ₹{statistics.avgLifetimeValue.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Total Customers</span>
                                <span className="text-sm font-semibold">{statistics.totalCustomers}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

