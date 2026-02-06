/**
 * Payments Service
 * Handles payment management operations for admin
 */

import { get } from './api-client';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'ONLINE' | 'COD' | 'WALLET';

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  discountAmount?: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: PaymentStatus;
  method: PaymentMethod;
  couponId?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    status: string;
  };
  user?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Get all payments
 */
export async function getPayments(): Promise<Payment[]> {
  const response = await get<Payment[]>('/admin/payments');

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch payments');
  }

  return response.data;
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

