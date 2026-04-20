/**
 * Shipping Methods Service
 * CRUD + reorder for admin-managed shipping methods.
 */

import { get, post, put, del } from './api-client';

export interface ShippingMethod {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    estimatedDays?: string | null;
    icon?: string | null;
    iconColor?: string | null;
    isActive: boolean;
    isDefault: boolean;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateShippingMethodData {
    name: string;
    description?: string | null;
    price: number;
    estimatedDays?: string | null;
    icon?: string | null;
    iconColor?: string | null;
    isActive?: boolean;
    isDefault?: boolean;
    displayOrder?: number;
}

export interface UpdateShippingMethodData {
    name?: string;
    description?: string | null;
    price?: number;
    estimatedDays?: string | null;
    icon?: string | null;
    iconColor?: string | null;
    isActive?: boolean;
    isDefault?: boolean;
    displayOrder?: number;
}

export interface GetShippingMethodsParams {
    search?: string;
    isActive?: boolean;
}

/**
 * List all shipping methods (admin — includes inactive).
 */
export async function getShippingMethods(
    params?: GetShippingMethodsParams,
): Promise<ShippingMethod[]> {
    const query = new URLSearchParams();

    if (params?.search) {
        query.set('search', params.search);
    }
    if (typeof params?.isActive === 'boolean') {
        query.set('isActive', String(params.isActive));
    }

    const queryString = query.toString();
    const endpoint = `/admin/shipping-methods${queryString ? `?${queryString}` : ''}`;

    const response = await get<{ methods: ShippingMethod[] }>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch shipping methods');
    }

    return response.data.methods;
}

/**
 * Get a single shipping method by id.
 */
export async function getShippingMethod(id: string): Promise<ShippingMethod> {
    const response = await get<ShippingMethod>(`/admin/shipping-methods/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch shipping method');
    }

    return response.data;
}

/**
 * Create a new shipping method.
 * If `isDefault: true`, backend unsets any existing default in the same transaction.
 */
export async function createShippingMethod(
    data: CreateShippingMethodData,
): Promise<ShippingMethod> {
    const response = await post<ShippingMethod>('/admin/shipping-methods', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create shipping method');
    }

    return response.data;
}

/**
 * Update an existing shipping method (partial).
 * If `isDefault: true`, backend unsets any existing default in the same transaction.
 */
export async function updateShippingMethod(
    id: string,
    data: UpdateShippingMethodData,
): Promise<ShippingMethod> {
    const response = await put<ShippingMethod>(`/admin/shipping-methods/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update shipping method');
    }

    return response.data;
}

/**
 * Delete a shipping method.
 * Orders referencing this method keep their snapshot `shippingCharges`
 * (FK is `SET NULL`).
 */
export async function deleteShippingMethod(id: string): Promise<void> {
    const response = await del<null>(`/admin/shipping-methods/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete shipping method');
    }
}

/**
 * Reorder shipping methods by passing an array of ids in the desired order.
 * The backend sets `displayOrder` to the array index of each id.
 */
export async function reorderShippingMethods(order: string[]): Promise<void> {
    const response = await post<null>('/admin/shipping-methods/reorder', { order });

    if (!response.success) {
        throw new Error(response.error || 'Failed to reorder shipping methods');
    }
}
