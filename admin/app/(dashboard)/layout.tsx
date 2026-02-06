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

    useEffect(() => {
        const token = getAuthToken();

        if (!token) {
            router.replace('/login');
        } else {
            setIsAuthenticated(true);
            setIsChecking(false);
        }
    }, [router]);

    if (isChecking) {
        return <PageLoading />;
    }

    if (!isAuthenticated) {
        return null;
    }

    return <DashboardLayout>{children}</DashboardLayout>;
}

