import { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyOrders, Order, OrderStatus, OrdersResponse } from '@/lib/api/orders';

export interface FormattedOrder {
  id: string;
  orderNumber: string;
  date: string;
  status: OrderStatus;
  displayStatus: string;
  total: number;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }[];
}

export const displayStatusMap: Record<OrderStatus, string> = {
  PENDING_REVIEW: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Map display status back to OrderStatus for filtering
const displayToApiStatusMap: Record<string, OrderStatus> = {
  'Pending': 'PENDING_REVIEW',
  'Accepted': 'ACCEPTED',
  'Rejected': 'REJECTED',
  'Processing': 'PROCESSING',
  'Shipped': 'SHIPPED',
  'Delivered': 'DELIVERED',
  'Cancelled': 'CANCELLED',
};

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMyOrders();

      if (response.success && response.data) {
        const ordersData = response.data as OrdersResponse;
        setOrders(ordersData.orders || []);
      } else {
        setError(response.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formattedOrders: FormattedOrder[] = useMemo(() => {
    return orders.map((order) => {
      const date = new Date(order.createdAt);
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const orderNumber = `ORD-${order.id.slice(0, 8).toUpperCase()}`;

      const formattedItems = order.items.map((item) => ({
        id: item.id,
        name: item.product?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        image: item.product?.images?.[0]?.url,
      }));

      return {
        id: order.id,
        orderNumber,
        date: formattedDate,
        status: order.status,
        displayStatus: displayStatusMap[order.status] || order.status,
        total: order.total,
        items: formattedItems,
      };
    });
  }, [orders]);

  const getOrdersByStatus = (status: OrderStatus | 'all') => {
    if (status === 'all') {
      return formattedOrders;
    }
    return formattedOrders.filter((order) => order.status === status);
  };

  const searchOrders = useCallback((query: string, statusFilter: string = 'all') => {
    // Convert display status to API status
    const apiStatus = statusFilter === 'all' ? 'all' : (displayToApiStatusMap[statusFilter] || statusFilter);

    const filteredByStatus = apiStatus === 'all'
      ? formattedOrders
      : formattedOrders.filter((order) => order.status === apiStatus);

    if (!query) {
      return filteredByStatus;
    }

    const searchLower = query.toLowerCase();
    return filteredByStatus.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(searchLower) ||
        order.items.some((item) => item.name.toLowerCase().includes(searchLower))
    );
  }, [formattedOrders]);

  return {
    orders: formattedOrders,
    rawOrders: orders,
    loading,
    error,
    refetch: fetchOrders,
    getOrdersByStatus,
    searchOrders,
  };
};
