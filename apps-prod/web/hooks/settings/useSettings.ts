import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProfile,
  updateProfile,
  updatePassword,
  updateNotificationPreferences,
  deleteAccount,
  UpdateProfileData,
  NotificationPreferences,
  User,
} from '@/lib/api/auth';

export const useSettings = () => {
  const { user, refreshUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    email: true,
    sms: false,
    push: true,
    orderUpdates: true,
    promotions: false,
    newsletters: false,
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user) {
      setUserData(user);
      if (user.notificationPreferences) {
        setNotificationPreferences(user.notificationPreferences as NotificationPreferences);
      }
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProfile();

      if (response.success && response.data) {
        setUserData(response.data);
        if (response.data.notificationPreferences) {
          setNotificationPreferences(response.data.notificationPreferences as NotificationPreferences);
        }
      } else {
        setError(response.error || 'Failed to fetch user data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = useCallback(async (data: UpdateProfileData): Promise<boolean> => {
    try {
      setError(null);
      const response = await updateProfile(data);

      if (response.success && response.data) {
        await refreshUser();
        return true;
      } else {
        setError(response.error || 'Failed to update profile');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return false;
    }
  }, [refreshUser]);

  const handleUpdatePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      setError(null);

      const response = await updatePassword(currentPassword, newPassword);

      if (response.success) {
        return true;
      } else {
        setError(response.error || 'Failed to update password');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
      return false;
    }
  }, []);

  const handleUpdateNotifications = useCallback(async (preferences: NotificationPreferences): Promise<boolean> => {
    try {
      setError(null);
      const response = await updateNotificationPreferences(preferences);

      if (response.success && response.data) {
        setNotificationPreferences(preferences);
        await refreshUser();
        return true;
      } else {
        setError(response.error || 'Failed to update notification preferences');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification preferences');
      return false;
    }
  }, [refreshUser]);

  const handleDeleteAccount = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const response = await deleteAccount();

      if (response.success) {
        // Logout and redirect to home
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        return true;
      } else {
        setError(response.error || 'Failed to delete account');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      return false;
    }
  }, [logout]);

  return {
    user: userData,
    loading,
    error,
    notificationPreferences,
    updateProfile: handleUpdateProfile,
    updatePassword: handleUpdatePassword,
    updateNotifications: handleUpdateNotifications,
    deleteAccount: handleDeleteAccount,
    refetch: fetchUserData,
  };
};

