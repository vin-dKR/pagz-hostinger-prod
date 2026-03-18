/**
 * Dashboard Layout
 * Protected layout for all dashboard routes
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/api/api-client';
import { DashboardLayout } from '@/app/components/layouts/dashboard-layout';
import { PageLoading } from '@/app/components/ui/loading';

export default function Layout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
        const token = getAuthToken();

        if (!token) {
                    if (isMounted) {
            router.replace('/login');
                    }
        } else {
                    if (isMounted) {
            setIsAuthenticated(true);
            setIsChecking(false);
                        setHasError(false);
                    }
                }
            } catch (error) {
                console.error('[DashboardLayout] Error checking authentication:', error);
                if (isMounted) {
                    setHasError(true);
                    setIsChecking(false);
                    // On error, redirect to login for safety
                    router.replace('/login');
                }
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, [router]);

    if (isChecking) {
        return <PageLoading />;
    }

    if (hasError || !isAuthenticated) {
        return null;
    }

    return <DashboardLayout>{children}</DashboardLayout>;
}

