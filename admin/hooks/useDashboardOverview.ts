'use client';

import { useEffect, useState } from 'react';
import { getDashboardOverview, type DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface UseDashboardOverviewOptions {
    /**
     * Polling interval in milliseconds. Set to 0 or undefined to disable polling.
     */
    refreshIntervalMs?: number;
}

export function useDashboardOverview(options: UseDashboardOverviewOptions = {}) {
    const { refreshIntervalMs = 60_000 } = options;

    const [data, setData] = useState<DashboardOverviewResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getDashboardOverview();
            setData(result);
            setLastUpdatedAt(new Date());
        } catch (err: any) {
            setError(err?.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        void fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Polling
    useEffect(() => {
        if (!refreshIntervalMs || refreshIntervalMs <= 0) return;

        const id = setInterval(() => {
            void fetchData();
        }, refreshIntervalMs);

        return () => clearInterval(id);
    }, [refreshIntervalMs]);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
        lastUpdatedAt,
    };
}


