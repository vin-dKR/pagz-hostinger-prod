import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface OrdersTrendChartProps {
    data: DashboardOverviewResponse['timeSeries']['ordersLast30Days'];
    loading?: boolean;
}

export function OrdersTrendChart({ data, loading }: OrdersTrendChartProps) {
    return (
        <Card aria-label="Orders last 30 days chart">
            <CardHeader>
                <CardTitle>Orders (Last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
                {loading && !data.length ? (
                    <div className="h-40 animate-pulse rounded-md bg-gray-100" />
                ) : !data.length ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No order data available yet
                    </p>
                ) : (
                    <div className="h-40 w-full">
                        <div className="flex h-full items-end gap-0.5 overflow-hidden rounded-md bg-gray-50 p-2">
                            {data.map((point) => {
                                const maxCount = Math.max(...data.map((d) => d.count), 1);
                                const height = Math.round((point.count / maxCount) * 100);
                                return (
                                    <div
                                        key={point.date}
                                        className="flex-1 bg-blue-500/80"
                                        style={{ height: `${height}%` }}
                                        title={`${point.date}: ${point.count} orders`}
                                    />
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Simple inline visualization. Integrate a full chart library later if required.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


