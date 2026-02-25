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
            {/* Side by Side: Role Distribution and Registration Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Role Distribution Chart */}
                <Card className="shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-900">User Distribution by Role</h3>
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between items-center mb-2.5">
                                    <span className="text-sm font-semibold text-gray-700">Customers</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {statistics.totalCustomers.toLocaleString()} <span className="text-gray-500 font-normal">({customerPercent.toFixed(1)}%)</span>
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                                        style={{ width: `${customerPercent}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2.5">
                                    <span className="text-sm font-semibold text-gray-700">Admins</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {statistics.totalAdmins.toLocaleString()} <span className="text-gray-500 font-normal">({adminPercent.toFixed(1)}%)</span>
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                                        style={{ width: `${adminPercent}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2.5">
                                    <span className="text-sm font-semibold text-gray-700">Super Admins</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {statistics.totalSuperAdmins.toLocaleString()} <span className="text-gray-500 font-normal">({superAdminPercent.toFixed(1)}%)</span>
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                                        style={{ width: `${superAdminPercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Registration Trend */}
                <Card className="shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-900">Registration Trend</h3>
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-5">
                            {registrationTrend.map((item, index) => (
                                <div key={index}>
                                    <div className="flex justify-between items-center mb-2.5">
                                        <span className="text-sm font-semibold text-gray-700">{item.period}</span>
                                        <span className="text-sm font-bold text-gray-900">{item.count.toLocaleString()} <span className="text-gray-500 font-normal">users</span></span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-3 shadow-sm"
                                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                                        >
                                            {item.count > 0 && (
                                                <span className="text-xs text-white font-semibold">{item.count.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

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

