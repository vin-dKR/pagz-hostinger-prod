/**
 * User Profile Tab Component
 * Displays user information and statistics
 */

'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { formatDate } from '@/lib/utils/format';
import { Mail, Phone, Shield, Calendar, User as UserIcon } from 'lucide-react';
import { User } from '@/lib/api/users.service';
import { UserSecurityActions } from './user-security-actions';
import { UserCommunication } from './user-communication';

interface UserProfileProps {
    userId: string;
    user: User & { statistics?: any };
}

export function UserProfile({ user }: UserProfileProps) {
    return (
        <div className="space-y-6">
            {/* User Information Card */}
            <Card>
                <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">User Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-600">Full Name</label>
                            <p className="font-medium">{user.name || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Email</label>
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline">
                                    {user.email}
                                </a>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Phone</label>
                            {user.phone ? (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    <a href={`tel:${user.phone}`} className="text-blue-600 hover:underline">
                                        {user.phone}
                                    </a>
                                </div>
                            ) : (
                                <p className="text-gray-400">N/A</p>
                            )}
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Role</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Shield className="h-4 w-4 text-gray-400" />
                                {user.isSuperAdmin ? (
                                    <Badge variant="destructive">Super Admin</Badge>
                                ) : user.isAdmin ? (
                                    <Badge variant="default">Admin</Badge>
                                ) : (
                                    <Badge variant="secondary">Customer</Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">User ID</label>
                            <p className="font-mono text-sm">{user.id}</p>
                        </div>
                        {user.supabaseId && (
                            <div>
                                <label className="text-sm text-gray-600">Supabase ID</label>
                                <p className="font-mono text-sm">{user.supabaseId}</p>
                            </div>
                        )}
                        <div>
                            <label className="text-sm text-gray-600">Registration Date</label>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <p>{formatDate(user.createdAt)}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Last Updated</label>
                            <p>{formatDate(user.updatedAt)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Statistics Card */}
            {user.statistics && (
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Statistics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-sm text-gray-600">Total Orders</label>
                                <p className="text-2xl font-bold">{user.statistics.totalOrders}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Total Spent</label>
                                <p className="text-2xl font-bold">₹{user.statistics.totalSpent.toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Average Order Value</label>
                                <p className="text-2xl font-bold">
                                    ₹{user.statistics.avgOrderValue?.toLocaleString() || '0'}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Total Reviews</label>
                                <p className="text-2xl font-bold">{user.statistics.totalReviews}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Addresses</label>
                                <p className="text-2xl font-bold">{user.statistics.addressesCount}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Wishlist Items</label>
                                <p className="text-2xl font-bold">{user.statistics.wishlistItemsCount}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Cart Items</label>
                                <p className="text-2xl font-bold">{user.statistics.cartItemsCount}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">Account Age</label>
                                <p className="text-2xl font-bold">{user.statistics.accountAge || 0} days</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Activity Summary */}
            {user.statistics && (
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Activity Summary</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Last Order</span>
                                <span>
                                    {user.statistics.lastOrderDate
                                        ? formatDate(user.statistics.lastOrderDate)
                                        : 'Never'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Last Review</span>
                                <span>
                                    {user.statistics.lastReviewDate
                                        ? formatDate(user.statistics.lastReviewDate)
                                        : 'Never'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Security Actions */}
            <Card>
                <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Security & Account Management</h2>
                    <UserSecurityActions
                        userId={user.id}
                        userName={user.name || user.email}
                        isSuspended={user.notificationPreferences && (user.notificationPreferences as any)?.suspension?.isSuspended}
                        onSuccess={() => {
                            // Reload user data
                            window.location.reload();
                        }}
                    />
                </CardContent>
            </Card>

            {/* Communication */}
            <UserCommunication
                userId={user.id}
                user={user}
                onSuccess={() => {
                    // Reload user data
                    window.location.reload();
                }}
            />
        </div>
    );
}

