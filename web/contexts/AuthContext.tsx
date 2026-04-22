"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import {
    login as apiLogin,
    register as apiRegister,
    getProfile,
    User,
    RegisterData,
} from '../lib/api/auth';
import { setAuthToken, getAuthToken, ApiError } from '../lib/api-client';
import { setUserCookie, getUserCookie, removeUserCookie } from '../lib/cookies';

interface LoginInput {
    phone?: string;
    email?: string;
    password: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (input: LoginInput) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const isCheckingAuthRef = React.useRef(false);

    const checkAuth = useCallback(async () => {
        if (isCheckingAuthRef.current) return;
        isCheckingAuthRef.current = true;

        const token = getAuthToken();
        const cachedUser = getUserCookie();
        if (cachedUser && !user) setUser(cachedUser as User);

        if (!token) {
            setLoading(false);
            removeUserCookie();
            setUser(null);
            isCheckingAuthRef.current = false;
            return;
        }

        const currentUser = user || cachedUser;

        try {
            const response = await getProfile();
            if (response.success && response.data) {
                setUser(response.data);
                setUserCookie(response.data);
            } else {
                setAuthToken(undefined);
                removeUserCookie();
                setUser(null);
            }
        } catch (error) {
            const apiError = error as ApiError;
            if (apiError.statusCode === 401) {
                setAuthToken(undefined);
                removeUserCookie();
                setUser(null);
            } else if (!currentUser) {
                setUser(null);
            }
        } finally {
            setLoading(false);
            isCheckingAuthRef.current = false;
        }
    }, [user]);

    useEffect(() => {
        checkAuth();
    }, []);

    const login = useCallback(async (input: LoginInput) => {
        const response = await apiLogin(input);

        if (!response.success || !response.data) {
            throw new Error(response.error || response.message || 'Login failed');
        }

        const { user: userData, token } = response.data;
        setAuthToken(token);
        setUser(userData);
        setUserCookie(userData);
    }, []);

    const register = useCallback(async (data: RegisterData) => {
        const response = await apiRegister(data);
        if (!response.success || !response.data) {
            throw new Error(response.error || response.message || 'Registration failed');
        }

        const { user: userData, token } = response.data;
        if (token && userData) {
            setAuthToken(token);
            setUser(userData);
            setUserCookie(userData);
        } else if (userData) {
            setUser(userData);
            setUserCookie(userData);
        }
    }, []);

    const logout = useCallback(() => {
        setAuthToken(undefined);
        setUser(null);
        removeUserCookie();
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const response = await getProfile();
            if (response.success && response.data) {
                setUser(response.data);
                setUserCookie(response.data);
            } else {
                const token = getAuthToken();
                if (!token) return;
                setAuthToken(undefined);
                setUser(null);
                removeUserCookie();
            }
        } catch (error) {
            const apiError = error as ApiError;
            if (apiError.statusCode === 401) {
                setAuthToken(undefined);
                setUser(null);
                removeUserCookie();
            }
        }
    }, []);

    const contextValue = useMemo(() => ({
        user,
        loading,
        isAuthenticated: !!user && !!getAuthToken(),
        login,
        register,
        logout,
        refreshUser,
    }), [user, loading, login, register, logout, refreshUser]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
