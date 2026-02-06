import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface RecentCustomersProps {
    recentCustomers: DashboardOverviewResponse['recentCustomers'];
    loading?: boolean;
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

export function RecentCustomers({ recentCustomers, loading }: RecentCustomersProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Customers</CardTitle>
            </CardHeader>
            <CardContent>
                {loading && !recentCustomers.length ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-10 animate-pulse rounded-md bg-gray-100"
                            />
                        ))}
                    </div>
                ) : !recentCustomers.length ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No customers yet
                    </p>
                ) : (
                    <div className="space-y-3 text-sm">
                        {recentCustomers.map((customer) => (
                            <div
                                key={customer.id}
                                className="flex items-center justify-between gap-3"
                            >
                                <div>
                                    <p className="font-medium">{customer.name}</p>
                                    <p className="text-xs text-gray-500">{customer.email}</p>
                                    <p className="text-xs text-gray-400">
                                        Joined {formatDate(customer.createdAt)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">
                                        Orders: {customer.totalOrders}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Spent: ₹{customer.totalSpent.toLocaleString('en-IN', {
                                            maximumFractionDigits: 0,
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


