/**
 * Wishlist API functions
 */

import { get, post, del, ApiResponse } from '../api-client';
import { Product } from './products';

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface WishlistResponse {
  wishlist: WishlistItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get user's wishlist
 */
export async function getWishlist(): Promise<ApiResponse<WishlistResponse>> {
  return get<WishlistResponse>('/wishlist');
}

/**
 * Add product to wishlist
 */
export async function addToWishlist(productId: string): Promise<ApiResponse<WishlistItem>> {
  return post<WishlistItem>('/wishlist', { productId });
}

/**
 * Remove product from wishlist
 */
export async function removeFromWishlist(productId: string): Promise<ApiResponse<void>> {
  return del<void>(`/wishlist/${productId}`);
}

/**
 * Check if product is in wishlist
 */
export async function checkWishlist(productId: string): Promise<ApiResponse<{ isInWishlist: boolean }>> {
  return get<{ isInWishlist: boolean }>(`/wishlist/check/${productId}`);
}

