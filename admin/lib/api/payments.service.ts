/**
 * Payments Service
 * Handles payment management operations for admin
 */

import { get, post, patch } from './api-client';

// ── Orphan payments (paid-but-no-order recovery) ──────────────────
// Razorpay can capture before the persist transaction lands the Order
// row. The `/orphans` endpoint exposes those rows so an admin can
// manually recover them via `/recover/:merchantOrderId`.

export interface OrphanPendingPayment {
  merchantOrderId: string;
  userId: string;
  amount: number;
  addressId: string;
  couponCode: string | null;
  createdAt: string;
  expiresAt: string;
  itemCount: number;
}

export interface OrphanPaymentsResponse {
  orphans: OrphanPendingPayment[];
  count: number;
}

export interface RecoverStuckPaymentBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}

export interface RecoverStuckPaymentResult {
  orderId: string;
  raced?: boolean;
  alreadyExisted?: boolean;
  correlationId?: string;
}

/** GET /api/v1/admin/payments/orphans */
export async function getOrphanPendingPayments(): Promise<OrphanPaymentsResponse> {
  const response = await get<OrphanPaymentsResponse>('/admin/payments/orphans');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch orphan payments');
  }
  return response.data;
}

/** POST /api/v1/admin/payments/recover/:merchantOrderId */
export async function recoverStuckPayment(
  merchantOrderId: string,
  body: RecoverStuckPaymentBody,
): Promise<RecoverStuckPaymentResult> {
  const response = await post<RecoverStuckPaymentResult>(
    `/admin/payments/recover/${encodeURIComponent(merchantOrderId)}`,
    body,
  );
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Recovery failed');
  }
  return response.data;
}

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'ONLINE' | 'OFFLINE';

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  discountAmount?: number;
  gatewayOrderId?: string;
  gatewayTransactionId?: string;
  status: PaymentStatus;
  method: PaymentMethod;
  paymentInstrument?: string;
  paymentDetails?: {
    vpa?: string;
    cardNetwork?: string;
    cardType?: string;
    last4?: string;
    issuer?: string;
    bankName?: string;
    walletType?: string;
  };
  couponId?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    status: string;
    total: number;
    createdAt: string;
  };
  user?: {
    id: string;
    name?: string;
    email: string;
    phone?: string;
  };
  coupon?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PaymentQueryParams {
  page?: number;
  limit?: number;
  status?: PaymentStatus | PaymentStatus[];
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  userId?: string;
  orderId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'amount' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaymentsResponse {
  payments: Payment[];
  pagination: PaginationMeta;
}

export interface PaymentStatistics {
  totalPayments: number;
  totalAmount: number;
  successfulPayments: number;
  successfulAmount: number;
  pendingPayments: number;
  pendingAmount: number;
  failedPayments: number;
  failedAmount: number;
  refundedPayments: number;
  refundedAmount: number;
  averageTransactionValue: number;
  byMethod: Record<PaymentMethod, { count: number; amount: number }>;
  byStatus: Record<PaymentStatus, { count: number; amount: number }>;
  recentPayments: Payment[];
  dailyStats: Array<{ date: string; count: number; amount: number }>;
}

export interface RefundData {
  amount?: number;
  reason: string;
  method?: 'AUTOMATIC' | 'MANUAL';
  notes?: string;
}

/**
 * Get all payments with filters and pagination
 */
export async function getPayments(
  params?: PaymentQueryParams
): Promise<PaginatedResponse<Payment>> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  // Handle status (array or single)
  if (params?.status) {
    if (Array.isArray(params.status)) {
      params.status.forEach(s => queryParams.append('status', s));
    } else {
      queryParams.append('status', params.status);
    }
  }
  
  if (params?.method) queryParams.append('method', params.method);
  if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params?.minAmount) queryParams.append('minAmount', params.minAmount.toString());
  if (params?.maxAmount) queryParams.append('maxAmount', params.maxAmount.toString());
  if (params?.userId) queryParams.append('userId', params.userId);
  if (params?.orderId) queryParams.append('orderId', params.orderId);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const queryString = queryParams.toString();
  const endpoint = `/admin/payments${queryString ? `?${queryString}` : ''}`;

  const response = await get<PaymentsResponse>(endpoint);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch payments');
  }

  return {
    items: response.data.payments,
    pagination: response.data.pagination,
  };
}

/**
 * Get single payment by ID
 */
export async function getPayment(id: string): Promise<Payment> {
  const response = await get<Payment>(`/admin/payments/${id}`);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch payment');
  }

  return response.data;
}

/**
 * Get payment statistics
 */
export async function getPaymentStatistics(params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<PaymentStatistics> {
  const queryParams = new URLSearchParams();
  if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.append('dateTo', params.dateTo);

  const queryString = queryParams.toString();
  const endpoint = `/admin/payments/statistics${queryString ? `?${queryString}` : ''}`;

  const response = await get<PaymentStatistics>(endpoint);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch payment statistics');
  }

  return response.data;
}

/**
 * Process payment refund
 */
export async function processPaymentRefund(
  paymentId: string,
  data: RefundData
): Promise<Payment> {
  const response = await post<Payment>(`/admin/payments/${paymentId}/refund`, data);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to process refund');
  }

  return response.data;
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  paymentId: string,
  data: { status: PaymentStatus; notes?: string }
): Promise<Payment> {
  const response = await patch<Payment>(`/admin/payments/${paymentId}/status`, data);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update payment status');
  }

  return response.data;
}

/**
 * Export payments
 */
export async function exportPayments(
  params?: PaymentQueryParams & { format?: 'csv' | 'json' }
): Promise<void> {
  const queryParams = new URLSearchParams();

  if (params?.status) {
    if (Array.isArray(params.status)) {
      params.status.forEach(s => queryParams.append('status', s));
    } else {
      queryParams.append('status', params.status);
    }
  }

  if (params?.method) queryParams.append('method', params.method);
  if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params?.minAmount) queryParams.append('minAmount', params.minAmount.toString());
  if (params?.maxAmount) queryParams.append('maxAmount', params.maxAmount.toString());
  if (params?.userId) queryParams.append('userId', params.userId);
  if (params?.orderId) queryParams.append('orderId', params.orderId);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.format) queryParams.append('format', params.format);

  const queryString = queryParams.toString();
  const endpoint = `/admin/payments/export${queryString ? `?${queryString}` : ''}`;

  const { getAuthToken } = await import('./api-client');
  const token = getAuthToken();
  const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1'}${endpoint}`;

  const response = await fetch(
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to export payments');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `payments-export-${new Date().toISOString().split('T')[0]}.${params?.format || 'csv'}`;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
