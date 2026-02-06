import { useState, useEffect, useCallback } from 'react';
import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  Address,
  CreateAddressData,
  UpdateAddressData,
} from '@/lib/api/addresses';
import { getProfile, User } from '@/lib/api/auth';

export const useAddresses = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile which includes addresses
      const profileResponse = await getProfile();

      if (profileResponse.success && profileResponse.data) {
        setUser(profileResponse.data);
        setAddresses(profileResponse.data.addresses || []);
      } else {
        setError(profileResponse.error || 'Failed to fetch addresses');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleCreateAddress = useCallback(async (data: CreateAddressData): Promise<boolean> => {
    try {
      setError(null);
      const response = await createAddress(data);

      if (response.success && response.data) {
        // Refetch addresses after creation
        await fetchAddresses();
        return true;
      } else {
        setError(response.error || 'Failed to create address');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create address');
      return false;
    }
  }, [fetchAddresses]);

  const handleUpdateAddress = useCallback(async (id: string, data: UpdateAddressData): Promise<boolean> => {
    try {
      setError(null);
      const response = await updateAddress(id, data);

      if (response.success && response.data) {
        // Refetch addresses after update
        await fetchAddresses();
        return true;
      } else {
        setError(response.error || 'Failed to update address');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update address');
      return false;
    }
  }, [fetchAddresses]);

  const handleDeleteAddress = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await deleteAddress(id);

      if (response.success) {
        // Refetch addresses after deletion
        await fetchAddresses();
        return true;
      } else {
        setError(response.error || 'Failed to delete address');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete address');
      return false;
    }
  }, [fetchAddresses]);

  const handleSetDefaultAddress = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);

      // First, set all addresses to isDefault: false, then set the selected one to true
      // This ensures only one address is default (handled on backend, but we can optimize here)
      const response = await setDefaultAddress(id);

      if (response.success && response.data) {
        // Refetch addresses after setting default to get updated state
        await fetchAddresses();
        return true;
      } else {
        setError(response.error || 'Failed to set default address');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default address');
      return false;
    }
  }, [fetchAddresses]);

  return {
    addresses,
    user,
    loading,
    error,
    refetch: fetchAddresses,
    createAddress: handleCreateAddress,
    updateAddress: handleUpdateAddress,
    deleteAddress: handleDeleteAddress,
    setDefaultAddress: handleSetDefaultAddress,
  };
};

