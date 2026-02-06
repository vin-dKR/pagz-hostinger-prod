import { get } from './api-client';

export interface DashboardOverviewResponse {
    stats: {
        totalProducts: number;
        totalActiveProducts: number;
        totalCategories: number;

        totalOrders: number;
        pendingOrders: number;
        processingOrders: number;
        completedOrders: number;
        cancelledOrders: number;

        totalRevenue: number;
        revenueThisMonth: number;
        revenueToday: number;

        totalCustomers: number;
        newCustomersThisMonth: number;

        totalCoupons: number;
        activeCoupons: number;

        totalReviews: number;
        averageRating: number | null;
    };

    recentOrders: Array<{
        id: string;
        orderNumber: string;
        customerName: string;
        customerEmail?: string;
        createdAt: string;
        status: string;
        totalAmount: number;
        itemCount: number;
        paymentStatus?: string;
    }>;

    topProducts: Array<{
        id: string;
        name: string;
        slug?: string | null;
        totalOrders: number;
        totalRevenue: number;
        imageUrl?: string;
    }>;

    recentCustomers: Array<{
        id: string;
        name: string;
        email: string;
        createdAt: string;
        totalOrders: number;
        totalSpent: number;
    }>;

    recentCoupons: Array<{
        id: string;
        code: string;
        discountType: 'PERCENTAGE' | 'FIXED';
        discountValue: number;
        usageCount: number;
        maxUsage?: number | null;
        isActive: boolean;
        expiresAt?: string | null;
    }>;

    timeSeries: {
        revenueLast30Days: Array<{ date: string; revenue: number }>;
        ordersLast30Days: Array<{ date: string; count: number }>;
    };
}

export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
    const response = await get<DashboardOverviewResponse>('/admin/dashboard/overview');

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch dashboard overview');
    }

    return response.data;
}


