/**
 * Shared TypeScript types for Admin Panel
 */

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

