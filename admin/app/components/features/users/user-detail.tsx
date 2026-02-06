/**
 * User Detail Component
 * Comprehensive user detail view with tabs
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import {
    getUser,
    type User,
} from '@/lib/api/users.service';
import { formatCurrency } from '@/lib/utils/format';
import { ArrowLeft, Edit, User as UserIcon, Package, MapPin, CreditCard, Star, Heart } from 'lucide-react';
import { UserProfile } from './user-profile';
import { UserOrders } from './user-orders';
import { UserAddresses } from './user-addresses';
import { UserPayments } from './user-payments';
import { UserReviews } from './user-reviews';
import { UserWishlistCart } from './user-wishlist-cart';
import { EditUserModal } from './edit-user-modal';

interface UserDetailProps {
    userId: string;
}

export function UserDetail({ userId, initialUser }: UserDetailProps & { initialUser?: User & { statistics?: any } }) {
    const router = useRouter();
    const [user, setUser] = useState<(User & { statistics?: any }) | null>(initialUser || null);
    const [isLoading, setIsLoading] = useState(!initialUser);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        if (!initialUser) {
            loadUser();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, initialUser]);

    const loadUser = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const userData = await getUser(userId);
            setUser(userData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load user');
        } finally {
            setIsLoading(false);
        }
    };

    const getInitials = (name?: string, email?: string) => {
        if (name) {
            return name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        return email ? email[0]?.toUpperCase() : 'U';
    };

    const getRoleBadge = (user: User) => {
        if (user.isSuperAdmin) {
            return <Badge variant="destructive">Super Admin</Badge>;
        }
        if (user.isAdmin) {
            return <Badge variant="default">Admin</Badge>;
        }
        return <Badge variant="secondary">Customer</Badge>;
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error || !user) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Alert variant="error">{error || 'User not found'}</Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                            {getInitials(user.name, user.email)}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">{user.name || 'N/A'}</h1>
                            <p className="text-gray-600">{user.email}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {getRoleBadge(user)}
                    <Button
                        variant="outline"
                        onClick={() => setIsEditModalOpen(true)}
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                </div>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Orders</p>
                                <p className="text-2xl font-bold">{user.statistics?.totalOrders || 0}</p>
                            </div>
                            <Package className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Spent</p>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(user.statistics?.totalSpent || 0)}
                                </p>
                            </div>
                            <CreditCard className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Reviews</p>
                                <p className="text-2xl font-bold">{user.statistics?.totalReviews || 0}</p>
                            </div>
                            <Star className="h-8 w-8 text-yellow-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Addresses</p>
                                <p className="text-2xl font-bold">{user.statistics?.addressesCount || 0}</p>
                            </div>
                            <MapPin className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">
                        <UserIcon className="h-4 w-4 mr-2" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="orders">
                        <Package className="h-4 w-4 mr-2" />
                        Orders
                    </TabsTrigger>
                    <TabsTrigger value="addresses">
                        <MapPin className="h-4 w-4 mr-2" />
                        Addresses
                    </TabsTrigger>
                    <TabsTrigger value="payments">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Payments
                    </TabsTrigger>
                    <TabsTrigger value="reviews">
                        <Star className="h-4 w-4 mr-2" />
                        Reviews
                    </TabsTrigger>
                    <TabsTrigger value="wishlist-cart">
                        <Heart className="h-4 w-4 mr-2" />
                        Wishlist & Cart
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <UserProfile userId={userId} user={user} />
                </TabsContent>

                <TabsContent value="orders">
                    <UserOrders userId={userId} />
                </TabsContent>

                <TabsContent value="addresses">
                    <UserAddresses userId={userId} />
                </TabsContent>

                <TabsContent value="payments">
                    <UserPayments userId={userId} />
                </TabsContent>

                <TabsContent value="reviews">
                    <UserReviews userId={userId} />
                </TabsContent>

                <TabsContent value="wishlist-cart">
                    <UserWishlistCart userId={userId} />
                </TabsContent>
            </Tabs>

            {/* Edit User Modal */}
            <EditUserModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                user={user}
                onSuccess={() => {
                    loadUser();
                    setIsEditModalOpen(false);
                }}
                currentUserIsSuperAdmin={false} // TODO: Get from auth context
            />
        </div>
    );
}

