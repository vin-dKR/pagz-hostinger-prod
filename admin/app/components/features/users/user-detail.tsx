/**
 * User Detail Component
 * Comprehensive user detail view with tabs
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import {
    getUser,
    type User,
} from '@/lib/api/users.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
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
        <div className="mx-auto max-w-[1560px] space-y-6 pb-12">
            {/* Header */}
            <div className="border-b border-[var(--color-border)] pb-6">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 mb-4 h-8 gap-1.5 text-[var(--color-foreground-secondary)]">
                    <ArrowLeft className="h-4 w-4" />
                    Users
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-primary)] sm:h-16 sm:w-16">
                            {getInitials(user.name, user.email)}
                        </div>
                        <div className="min-w-0">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-tertiary)]">Customer profile</p>
                            <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--color-foreground)] sm:text-[30px]">{user.name || 'N/A'}</h1>
                            <p className="mt-1 truncate text-sm text-[var(--color-foreground-secondary)]">{user.email} <span className="mx-1.5 text-[var(--color-foreground-tertiary)]">·</span> Joined {formatDate(user.createdAt)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {getRoleBadge(user)}
                        <Button variant="outline" onClick={() => setIsEditModalOpen(true)} className="gap-2"><Edit className="h-4 w-4" />Edit profile</Button>
                    </div>
                </div>
            </div>

            {/* Quick Info Cards */}
            <div className="admin-panel grid grid-cols-2 gap-1 md:grid-cols-4">
                {[
                    { label: 'Total orders', value: (user.statistics?.totalOrders || 0).toLocaleString(), icon: Package },
                    { label: 'Total spent', value: formatCurrency(user.statistics?.totalSpent || 0), icon: CreditCard },
                    { label: 'Reviews', value: (user.statistics?.totalReviews || 0).toLocaleString(), icon: Star },
                    { label: 'Addresses', value: (user.statistics?.addressesCount || 0).toLocaleString(), icon: MapPin },
                ].map((metric) => {
                    const Icon = metric.icon;
                    return <div key={metric.label} className="min-w-0"><div className="flex min-h-8 items-center justify-between gap-2 px-3 text-[11px] font-medium text-[var(--color-foreground-secondary)]"><span>{metric.label}</span><Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-foreground-tertiary)]" aria-hidden="true" /></div><p className="admin-panel-interior truncate px-3 py-4 text-xl font-semibold tracking-tight tabular-nums text-[var(--color-foreground)] sm:text-2xl">{metric.value}</p></div>;
                })}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="overflow-x-auto pb-1">
                <TabsList className="h-auto w-max min-w-full justify-start rounded-none border-0 border-b border-[var(--color-border)] bg-transparent p-0">
                    <TabsTrigger value="overview" className="h-10">
                        <UserIcon className="h-4 w-4 mr-2" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="h-10">
                        <Package className="h-4 w-4 mr-2" />
                        Orders
                    </TabsTrigger>
                    <TabsTrigger value="addresses" className="h-10">
                        <MapPin className="h-4 w-4 mr-2" />
                        Addresses
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="h-10">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Payments
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="h-10">
                        <Star className="h-4 w-4 mr-2" />
                        Reviews
                    </TabsTrigger>
                    <TabsTrigger value="wishlist-cart" className="h-10">
                        <Heart className="h-4 w-4 mr-2" />
                        Wishlist & Cart
                    </TabsTrigger>
                </TabsList>
                </div>

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
