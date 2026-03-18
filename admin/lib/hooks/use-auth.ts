'use client';

/**
 * Authentication Hook
 * Manages admin authentication state
 */

import { useState, useEffect } from 'react';
import { setAuthToken, getAuthToken } from '../api/api-client';
import type { AdminUser } from '../api/auth.service';

export function useAuth() {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
        // Check if user is authenticated
        const token = getAuthToken();

        if (token) {
            // TODO: Verify token and fetch user data
            // For now, just check if token exists
                    if (isMounted) {
            setIsLoading(false);
                        setError(null);
                    }
        } else {
                    if (isMounted) {
                        setIsLoading(false);
                        setError(null);
                    }
                }
            } catch (err) {
                console.error('[useAuth] Error checking authentication:', err);
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error('Failed to check authentication'));
            setIsLoading(false);
        }
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    const login = (userData: AdminUser, token: string) => {
        try {
        setAuthToken(token);
        setUser(userData);
            setError(null);
        } catch (err) {
            console.error('[useAuth] Error during login:', err);
            setError(err instanceof Error ? err : new Error('Failed to save authentication'));
        }
    };

    const logout = () => {
        try {
        setAuthToken(undefined);
        setUser(null);
            setError(null);
        } catch (err) {
            console.error('[useAuth] Error during logout:', err);
            setError(err instanceof Error ? err : new Error('Failed to clear authentication'));
        }
    };

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        error,
        login,
        logout,
    };
}

