/**
 * Addresses API functions
 */

import { get, post, put, del, ApiResponse } from '../api-client';

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
}

export interface CreateAddressData {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
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
 * Get user's addresses (from profile)
 * Note: Addresses are included in the user profile response
 * This function is kept for consistency but the hook uses getProfile directly
 */
export async function getAddresses(): Promise<ApiResponse<Address[]>> {
  const response = await get<any>('/auth/user/profile');

  if (response.success && response.data?.addresses) {
    return {
      success: true,
      data: response.data.addresses,
    };
  }

  return {
    success: false,
    error: response.error || 'Failed to fetch addresses',
  };
}

/**
 * Create a new address
 */
export async function createAddress(data: CreateAddressData): Promise<ApiResponse<Address>> {
  return post<Address>('/customer/address', data);
}

/**
 * Update an address
 * Note: This endpoint may need to be implemented on the backend
 */
export async function updateAddress(id: string, data: UpdateAddressData): Promise<ApiResponse<Address>> {
  return put<Address>(`/customer/address/${id}`, data);
}

/**
 * Delete an address
 * Note: This endpoint may need to be implemented on the backend
 */
export async function deleteAddress(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/customer/address/${id}`);
}

/**
 * Set an address as default
 * Updates the address with isDefault: true
 * The backend should ensure only one address is default at a time
 */
export async function setDefaultAddress(id: string): Promise<ApiResponse<Address>> {
  return put<Address>(`/customer/address/${id}`, { isDefault: true });
}

