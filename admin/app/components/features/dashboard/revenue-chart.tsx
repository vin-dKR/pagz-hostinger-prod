import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface RevenueChartProps {
    data: DashboardOverviewResponse['timeSeries']['revenueLast30Days'];
    loading?: boolean;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
    return (
        <Card aria-label="Revenue last 30 days chart">
            <CardHeader>
                <CardTitle>Revenue (Last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
                {loading && !data.length ? (
                    <div className="h-40 animate-pulse rounded-md bg-gray-100" />
                ) : !data.length ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No revenue data available yet
                    </p>
                ) : (
                    <div className="h-40 w-full">
                        {/* Placeholder simple bar visualization without external chart lib */}
                        <div className="flex h-full items-end gap-0.5 overflow-hidden rounded-md bg-gray-50 p-2">
                            {data.map((point) => {
                                const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
                                const height = Math.round((point.revenue / maxRevenue) * 100);
                                return (
                                    <div
                                        key={point.date}
                                        className="flex-1 bg-emerald-500/80"
                                        style={{ height: `${height}%` }}
                                        title={`${point.date}: ₹${point.revenue.toLocaleString('en-IN')}`}
                                    />
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Simple inline visualization. Integrate a full chart library (e.g. recharts) later if needed.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


