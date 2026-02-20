import { useState, useEffect, useMemo, useCallback } from 'react';
import { getProfile, User } from '@/lib/api/auth';
import { getMyOrders, OrdersResponse } from '@/lib/api/orders';
import { getWishlist, WishlistResponse } from '@/lib/api/wishlist';
import { OrderStatus } from '@/lib/api/orders';
import { useAuth } from '@/contexts/AuthContext';

export interface ProfileData {
    user: User | null;
    loading: boolean;
    error: string | null;
}

export interface RecentOrder {
    id: string;
    orderId: string;
    date: string;
    amount: string;
    status: string;
}

export interface ProfileStats {
    totalOrders: number;
    totalAddresses: number;
    wishlistItems: number;
}

const statusMap: Record<OrderStatus | string, string> = {
    "PENDING_REVIEW": 'Pending',
    "ACCEPTED": 'Accepted',
    "REJECTED": 'Rejected',
    "PROCESSING": 'Processing',
    "SHIPPED": 'Shipped',
    "DELIVERED": 'Delivered',
    "CANCELLED": 'Cancelled',
};

export const useProfile = () => {
    const { user: authUser, isAuthenticated } = useAuth();
    const [user, setUser] = useState<User | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [wishlistItems, setWishlistItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrdersAndWishlist = useCallback(async () => {
        try {
            // Fetch orders
            const ordersResponse = await getMyOrders();
            if (ordersResponse.success && ordersResponse.data) {
                const ordersData = ordersResponse.data as OrdersResponse;
                setOrders(ordersData.orders || []);
            }

            // Fetch wishlist
            try {
                const wishlistResponse = await getWishlist();
                if (wishlistResponse.success && wishlistResponse.data) {
                    const wishlistData = wishlistResponse.data as WishlistResponse;
                    setWishlistItems(wishlistData.wishlist || []);
                }
            } catch (wishlistError) {
                // Wishlist fetch failure shouldn't block profile loading
                console.warn('Failed to fetch wishlist:', wishlistError);
            }
        } catch (err) {
            console.error('Failed to fetch orders/wishlist:', err);
        }
    }, []);

    const fetchProfileData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Use auth user if available, otherwise fetch
            if (authUser) {
                setUser(authUser);
            } else {
                // Fetch user data
                const userResponse = await getProfile();
                if (userResponse.success && userResponse.data) {
                    setUser(userResponse.data);
                } else {
                    setError(userResponse.error || 'Failed to fetch user data');
                    setLoading(false);
                    return;
                }
            }

            // Fetch orders and wishlist
            await fetchOrdersAndWishlist();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    }, [authUser, fetchOrdersAndWishlist]);

    // Fetch profile data when auth state changes
    useEffect(() => {
        if (isAuthenticated && authUser) {
            // Update user from auth context immediately
            setUser(authUser);
            // Fetch orders and wishlist
            fetchOrdersAndWishlist();
        } else if (!isAuthenticated) {
            // Not authenticated - clear data
            setUser(null);
            setOrders([]);
            setWishlistItems([]);
            setLoading(false);
        }
    }, [isAuthenticated, authUser, fetchOrdersAndWishlist]);

    // Initial fetch on mount
    useEffect(() => {
        if (isAuthenticated) {
            fetchProfileData();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, fetchProfileData]);

    const formatMemberSince = (dateString: string): string => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const recentOrders: RecentOrder[] = useMemo(() => {
        return orders
            .slice(0, 3)
            .map((order) => {
                const date = new Date(order.createdAt);
                const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });

                return {
                    id: order.id,
                    orderId: `ORD-${order.id.slice(0, 8).toUpperCase()}`,
                    date: formattedDate,
                    amount: `₹${Number(order.total).toFixed(2)}`,
                    status: statusMap[order.status] || order.status,
                };
            });
    }, [orders]);

    const stats: ProfileStats = useMemo(() => {
        return {
            totalOrders: orders.length,
            totalAddresses: user?.addresses?.length || 0,
            wishlistItems: wishlistItems.length,
        };
    }, [orders, user, wishlistItems]);

    return {
        user,
        loading,
        error,
        recentOrders,
        stats,
        formatMemberSince,
        refetch: fetchProfileData,
    };
};

