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

    useEffect(() => {
        // Check if user is authenticated
        const token = getAuthToken();

        if (token) {
            // TODO: Verify token and fetch user data
            // For now, just check if token exists
            setIsLoading(false);
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = (userData: AdminUser, token: string) => {
        setAuthToken(token);
        setUser(userData);
    };

    const logout = () => {
        setAuthToken(undefined);
        setUser(null);
    };

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
    };
}

