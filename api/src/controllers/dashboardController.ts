import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { sendSuccess } from "../utils/response.js";

/**
 * Admin Dashboard Overview Controller
 *
 * Aggregates key metrics and recent activity for the admin dashboard.
 * This endpoint is optimized for read performance and should avoid N+1 queries.
 */
export const getDashboardOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const last30DaysStart = new Date(now);
        last30DaysStart.setDate(now.getDate() - 29);
        last30DaysStart.setHours(0, 0, 0, 0);

        // Basic stats (products, categories, customers, coupons, reviews)
        const [
            totalProducts,
            totalActiveProducts,
            totalCategories,
            totalCustomers,
            newCustomersThisMonth,
            totalCoupons,
            activeCoupons,
            reviewAggregate,
        ] = await Promise.all([
            prisma.product.count(),
            prisma.product.count({ where: { isActive: true } }),
            prisma.category.count(),
            prisma.user.count({
                where: { isAdmin: false, isSuperAdmin: false },
            }),
            prisma.user.count({
                where: {
                    isAdmin: false,
                    isSuperAdmin: false,
                    createdAt: { gte: monthStart },
                },
            }),
            prisma.coupon.count(),
            prisma.coupon.count({
                where: {
                    isActive: true,
                    validFrom: { lte: now },
                    validUntil: { gte: now },
                },
            }),
            prisma.review.aggregate({
                _count: { _all: true },
                _avg: { rating: true },
                where: { isApproved: true },
            }),
        ]);

        // Order stats and revenue
        const [ordersByStatus, lifetimeRevenueAgg, monthRevenueAgg, todayRevenueAgg] = await Promise.all([
            prisma.order.groupBy({
                by: ["status"],
                _count: { _all: true },
            }),
            prisma.order.aggregate({
                _sum: { total: true },
                where: { paymentStatus: "SUCCESS" },
            }),
            prisma.order.aggregate({
                _sum: { total: true },
                where: {
                    paymentStatus: "SUCCESS",
                    createdAt: { gte: monthStart },
                },
            }),
            prisma.order.aggregate({
                _sum: { total: true },
                where: {
                    paymentStatus: "SUCCESS",
                    createdAt: { gte: todayStart },
                },
            }),
        ]);

        let totalOrders = 0;
        let pendingOrders = 0;
        let processingOrders = 0;
        let completedOrders = 0;
        let cancelledOrders = 0;

        for (const item of ordersByStatus) {
            const count = item._count._all;
            totalOrders += count;

            switch (item.status) {
                case "PENDING_REVIEW":
                case "ACCEPTED":
                    pendingOrders += count;
                    break;
                case "PROCESSING":
                case "SHIPPED":
                    processingOrders += count;
                    break;
                case "DELIVERED":
                    completedOrders += count;
                    break;
                case "CANCELLED":
                case "REJECTED":
                    cancelledOrders += count;
                    break;
                default:
                    break;
            }
        }

        const totalRevenue = Number(lifetimeRevenueAgg._sum.total || 0);
        const revenueThisMonth = Number(monthRevenueAgg._sum.total || 0);
        const revenueToday = Number(todayRevenueAgg._sum.total || 0);

        const totalReviews = reviewAggregate._count._all;
        const averageRating = reviewAggregate._avg.rating
            ? Number(reviewAggregate._avg.rating)
            : null;

        // Recent orders
        const recentOrdersRaw = await prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                items: {
                    select: {
                        quantity: true,
                    },
                },
                payments: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        const recentOrders = recentOrdersRaw.map((order) => ({
            id: order.id,
            orderNumber: order.id,
            customerName: order.user?.name || "Guest",
            customerEmail: order.user?.email || undefined,
            createdAt: order.createdAt.toISOString(),
            status: order.status,
            totalAmount: Number(order.total),
            itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
            paymentStatus: order.paymentStatus || order.payments?.[0]?.status || undefined,
        }));

        // Top products by revenue (based on successful orders)
        const topOrderItems = await prisma.orderItem.findMany({
            where: {
                order: {
                    paymentStatus: "SUCCESS",
                },
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        images: {
                            where: { isPrimary: true },
                            take: 1,
                            select: {
                                url: true,
                            },
                        },
                    },
                },
            },
        });

        const productStatsMap = new Map<
            string,
            {
                id: string;
                name: string;
                slug?: string | null;
                totalOrders: number;
                totalRevenue: number;
                imageUrl?: string;
            }
        >();

        for (const item of topOrderItems) {
            if (!item.product) continue;
            const key = item.product.id;
            const existing = productStatsMap.get(key) || {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                totalOrders: 0,
                totalRevenue: 0,
                imageUrl: item.product.images?.[0]?.url,
            };

            existing.totalOrders += item.quantity;
            existing.totalRevenue += Number(item.price) * item.quantity;
            if (!existing.imageUrl && item.product.images?.[0]?.url) {
                existing.imageUrl = item.product.images[0].url;
            }

            productStatsMap.set(key, existing);
        }

        const topProducts = Array.from(productStatsMap.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 10);

        // Recent customers with aggregated order stats
        const recentCustomersRaw = await prisma.user.findMany({
            where: { isAdmin: false, isSuperAdmin: false },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
                orders: {
                    select: {
                        total: true,
                    },
                },
            },
        });

        const recentCustomers = recentCustomersRaw.map((user) => {
            const totalOrdersForUser = user.orders.length;
            const totalSpentForUser = user.orders.reduce(
                (sum, order) => sum + Number(order.total),
                0
            );

            return {
                id: user.id,
                name: user.name || "Customer",
                email: user.email,
                createdAt: user.createdAt.toISOString(),
                totalOrders: totalOrdersForUser,
                totalSpent: totalSpentForUser,
            };
        });

        // Recent coupons
        const recentCouponsRaw = await prisma.coupon.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
                _count: {
                    select: {
                        usages: true,
                    },
                },
            },
        });

        const recentCoupons = recentCouponsRaw.map((coupon) => ({
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType as "PERCENTAGE" | "FIXED",
            discountValue: Number(coupon.discountValue),
            usageCount: coupon._count.usages,
            maxUsage: coupon.usageLimit,
            isActive: coupon.isActive,
            expiresAt: coupon.validUntil ? coupon.validUntil.toISOString() : null,
        }));

        // Time series data (last 30 days)
        const ordersLast30DaysRaw = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: last30DaysStart,
                },
                paymentStatus: "SUCCESS",
            },
            select: {
                createdAt: true,
                total: true,
                id: true,
            },
        });

        const revenueByDate = new Map<string, number>();
        const ordersCountByDate = new Map<string, number>();

        for (const order of ordersLast30DaysRaw) {
            const dateKey = order.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD

            revenueByDate.set(
                dateKey,
                (revenueByDate.get(dateKey) || 0) + Number(order.total)
            );
            ordersCountByDate.set(
                dateKey,
                (ordersCountByDate.get(dateKey) || 0) + 1
            );
        }

        const revenueLast30Days: Array<{ date: string; revenue: number }> = [];
        const ordersLast30Days: Array<{ date: string; count: number }> = [];

        for (let i = 0; i < 30; i++) {
            const current = new Date(last30DaysStart);
            current.setDate(last30DaysStart.getDate() + i);

            const dateKey = current.toISOString().slice(0, 10);

            revenueLast30Days.push({
                date: dateKey,
                revenue: revenueByDate.get(dateKey) || 0,
            });

            ordersLast30Days.push({
                date: dateKey,
                count: ordersCountByDate.get(dateKey) || 0,
            });
        }

        return sendSuccess(res, {
            stats: {
                totalProducts,
                totalActiveProducts,
                totalCategories,
                totalOrders,
                pendingOrders,
                processingOrders,
                completedOrders,
                cancelledOrders,
                totalRevenue,
                revenueThisMonth,
                revenueToday,
                totalCustomers,
                newCustomersThisMonth,
                totalCoupons,
                activeCoupons,
                totalReviews,
                averageRating,
            },
            recentOrders,
            topProducts,
            recentCustomers,
            recentCoupons,
            timeSeries: {
                revenueLast30Days,
                ordersLast30Days,
            },
        });
    } catch (error) {
        next(error);
    }
};


