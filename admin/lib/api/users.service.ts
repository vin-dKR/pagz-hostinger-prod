/**
 * Users Service
 * Handles user management operations for admin
 */

import { get, put, post, del, patch } from './api-client';

export interface User {
    id: string;
    email: string;
    name?: string;
    phone?: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    supabaseId?: string;
    notificationPreferences?: any;
    createdAt: string;
    updatedAt: string;
    statistics?: UserStatistics;
}

export interface UserStatistics {
    totalOrders: number;
    totalSpent: number;
    totalReviews: number;
    addressesCount: number;
    wishlistItemsCount: number;
    cartItemsCount: number;
}

export interface UpdateUserData {
    name?: string;
    email?: string;
    phone?: string;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    notificationPreferences?: any;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: PaginationMeta;
}

export interface UserQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: 'super_admin' | 'admin' | 'customer';
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    hasOrders?: boolean;
    hasReviews?: boolean;
    state?: string;
    city?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface UserStatisticsResponse {
    totalUsers: number;
    newUsersThisMonth: number;
    newUsersThisWeek: number;
    newUsersToday: number;
    activeUsersLast30Days: number;
    totalCustomers: number;
    totalAdmins: number;
    totalSuperAdmins: number;
    avgOrdersPerUser: number;
    avgLifetimeValue: number;
}

export interface Address {
    id: string;
    userId: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        orders: number;
    };
}

export interface CreateAddressData {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    isDefault?: boolean;
}

export interface UpdateAddressData {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    isDefault?: boolean;
}

/**
 * Get paginated users with optional search and filters
 */
export async function getUsers(params: UserQueryParams = {}): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.role) searchParams.set('role', params.role);
    if (params.status) searchParams.set('status', params.status);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params.hasOrders !== undefined) searchParams.set('hasOrders', String(params.hasOrders));
    if (params.hasReviews !== undefined) searchParams.set('hasReviews', String(params.hasReviews));
    if (params.state) searchParams.set('state', params.state);
    if (params.city) searchParams.set('city', params.city);
    if (params.country) searchParams.set('country', params.country);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const query = searchParams.toString();
    const endpoint = query ? `/admin/users?${query}` : '/admin/users';

    const response = await get<PaginatedResponse<User>>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch users');
    }

    return response.data;
}

/**
 * Get user statistics
 */
export async function getUserStatistics(dateFrom?: string, dateTo?: string): Promise<UserStatisticsResponse> {
    const searchParams = new URLSearchParams();
    if (dateFrom) searchParams.set('dateFrom', dateFrom);
    if (dateTo) searchParams.set('dateTo', dateTo);

    const query = searchParams.toString();
    const endpoint = query ? `/admin/users/statistics?${query}` : '/admin/users/statistics';

    const response = await get<UserStatisticsResponse>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user statistics');
    }

    return response.data;
}

/**
 * Get single user by ID
 */
export async function getUser(id: string): Promise<User & { statistics: any }> {
    const response = await get<User & { statistics: any }>(`/admin/users/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user');
    }

    return response.data;
}

/**
 * Get user statistics by ID
 */
export async function getUserStatisticsById(id: string): Promise<any> {
    const response = await get<any>(`/admin/users/${id}/statistics`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user statistics');
    }

    return response.data;
}

/**
 * Get user orders
 */
export async function getUserOrders(
    id: string,
    params: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status) searchParams.set('status', params.status);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);

    const query = searchParams.toString();
    const endpoint = query ? `/admin/users/${id}/orders?${query}` : `/admin/users/${id}/orders`;

    const response = await get<PaginatedResponse<any>>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user orders');
    }

    return response.data;
}

/**
 * Get user addresses
 */
export async function getUserAddresses(id: string): Promise<Address[]> {
    const response = await get<Address[]>(`/admin/users/${id}/addresses`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user addresses');
    }

    return response.data;
}

/**
 * Add user address
 */
export async function addUserAddress(id: string, data: CreateAddressData): Promise<Address> {
    const response = await post<Address>(`/admin/users/${id}/addresses`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to add address');
    }

    return response.data;
}

/**
 * Update user address
 */
export async function updateUserAddress(id: string, addressId: string, data: UpdateAddressData): Promise<Address> {
    const response = await put<Address>(`/admin/users/${id}/addresses/${addressId}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update address');
    }

    return response.data;
}

/**
 * Delete user address
 */
export async function deleteUserAddress(id: string, addressId: string): Promise<void> {
    const response = await del(`/admin/users/${id}/addresses/${addressId}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete address');
    }
}

/**
 * Set default address
 */
export async function setDefaultAddress(id: string, addressId: string): Promise<Address> {
    const response = await patch<Address>(`/admin/users/${id}/addresses/${addressId}/set-default`, {});

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to set default address');
    }

    return response.data;
}

/**
 * Get user payments
 */
export async function getUserPayments(
    id: string,
    params: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status) searchParams.set('status', params.status);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);

    const query = searchParams.toString();
    const endpoint = query ? `/admin/users/${id}/payments?${query}` : `/admin/users/${id}/payments`;

    const response = await get<PaginatedResponse<any>>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user payments');
    }

    return response.data;
}

/**
 * Get user reviews
 */
export async function getUserReviews(
    id: string,
    params: { page?: number; limit?: number; rating?: number; isApproved?: boolean } = {}
): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.rating) searchParams.set('rating', String(params.rating));
    if (params.isApproved !== undefined) searchParams.set('isApproved', String(params.isApproved));

    const query = searchParams.toString();
    const endpoint = query ? `/admin/users/${id}/reviews?${query}` : `/admin/users/${id}/reviews`;

    const response = await get<PaginatedResponse<any>>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user reviews');
    }

    return response.data;
}

/**
 * Get user wishlist and cart
 */
export async function getUserWishlistAndCart(id: string): Promise<{ wishlistItems: any[]; cart: any }> {
    const response = await get<{ wishlistItems: any[]; cart: any }>(`/admin/users/${id}/wishlist-cart`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch wishlist and cart');
    }

    return response.data;
}

/**
 * Update user
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
    const response = await put<User>(`/admin/users/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update user');
    }

    return response.data;
}

/**
 * Create user
 */
export async function createUser(data: {
    name?: string;
    email: string;
    phone?: string;
    password?: string;
    role?: 'super_admin' | 'admin' | 'customer';
}): Promise<User> {
    const response = await post<User>('/admin/users', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create user');
    }

    return response.data;
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<void> {
    const response = await del(`/admin/users/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete user');
    }
}

/**
 * Reset user password
 */
export async function resetUserPassword(id: string, sendEmail: boolean = true): Promise<void> {
    const response = await post(`/admin/users/${id}/reset-password`, { sendEmail });

    if (!response.success) {
        throw new Error(response.error || 'Failed to reset password');
    }
}

/**
 * Suspend user account
 */
export async function suspendUser(id: string, reason?: string, duration?: number): Promise<User> {
    const response = await post<User>(`/admin/users/${id}/suspend`, { reason, duration });

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to suspend user');
    }

    return response.data;
}

/**
 * Activate user account
 */
export async function activateUser(id: string): Promise<User> {
    const response = await post<User>(`/admin/users/${id}/activate`, {});

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to activate user');
    }

    return response.data;
}

/**
 * Export users
 */
export async function exportUsers(
    format: 'csv' | 'excel' = 'csv',
    params: { role?: string; dateFrom?: string; dateTo?: string; userIds?: string[] } = {}
): Promise<void> {
    const searchParams = new URLSearchParams();
    searchParams.set('format', format);
    if (params.role) searchParams.set('role', params.role);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params.userIds && params.userIds.length > 0) {
        searchParams.set('userIds', params.userIds.join(','));
    }

    const query = searchParams.toString();
    const endpoint = `/admin/users/export${query ? `?${query}` : ''}`;

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';
    const token = typeof window !== 'undefined'
        ? document.cookie.split(';').find(c => c.trim().startsWith('admin_token='))?.split('=')[1]
        : null;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });

    if (!response.ok) {
        throw new Error('Failed to export users');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `users-export-${new Date().toISOString().split('T')[0]}.${format}`;
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
        }
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
