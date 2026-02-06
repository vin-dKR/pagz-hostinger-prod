import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface TopProductsProps {
    topProducts: DashboardOverviewResponse['topProducts'];
    loading?: boolean;
}

export function TopProducts({ topProducts, loading }: TopProductsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent>
                {loading && !topProducts.length ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-10 animate-pulse rounded-md bg-gray-100"
                            />
                        ))}
                    </div>
                ) : !topProducts.length ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No top products data available yet
                    </p>
                ) : (
                    <div className="space-y-3">
                        {topProducts.slice(0, 10).map((product) => (
                            <div
                                key={product.id}
                                className="flex items-center justify-between gap-3 text-sm"
                            >
                                <div className="flex items-center gap-3">
                                    {product.imageUrl ? (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="h-8 w-8 rounded object-cover"
                                        />
                                    ) : (
                                        <div className="h-8 w-8 rounded bg-gray-100" />
                                    )}
                                    <div>
                                        <p className="font-medium line-clamp-1">{product.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {product.totalOrders} orders
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm font-semibold">
                                    ₹{product.totalRevenue.toLocaleString('en-IN', {
                                        maximumFractionDigits: 0,
                                    })}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


