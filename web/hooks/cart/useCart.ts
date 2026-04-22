/**
 * useCart Hook
 * Manages cart data and operations with optimistic updates
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    type Cart,
    type CartItem,
    type CartResponse,
} from '@/lib/api/cart';
import { getAuthToken } from '@/lib/api-client';

export interface UseCartReturn {
    cart: Cart | null;
    items: CartItem[];
    loading: boolean;
    error: string | null;
    updatingItemId: string | null;
    removingItemId: string | null;
    total: number;
    baseSubtotal: number;
    addonsSubtotal: number;
    itemCount: number;
    refetch: () => Promise<void>;
    updateQuantity: (itemId: string, quantity: number) => Promise<boolean>;
    removeItem: (itemId: string) => Promise<boolean>;
    clearCartItems: () => Promise<boolean>;
    isProductInCart: (productName: string) => boolean;
}

export function useCart(): UseCartReturn {
    const [cart, setCart] = useState<Cart | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
    const [removingItemId, setRemovingItemId] = useState<string | null>(null);
    const [cartSubtotal, setCartSubtotal] = useState<number>(0);
    const [baseSubtotal, setBaseSubtotal] = useState<number>(0);
    const [addonsSubtotal, setAddonsSubtotal] = useState<number>(0);

    // Fetch cart data (with optional loading state control)
    const fetchCart = useCallback(async (setLoadingState = true) => {
        const callId = Math.random().toString(36).slice(2, 7);
        console.log(`[useCart:${callId}] fetchCart start, hasToken=${!!getAuthToken()}`);
        try {
            if (setLoadingState) {
                setLoading(true);
            }
            setError(null);
            if (!getAuthToken()) {
                console.warn(`[useCart:${callId}] no token → clearing cart state`);
                setCart(null);
                setCartSubtotal(0);
                setBaseSubtotal(0);
                setAddonsSubtotal(0);
                return;
            }
            const response = await getCart();
            console.log(`[useCart:${callId}] getCart response:`, {
                success: response.success,
                itemCount: (response.data as any)?.cart?.items?.length,
                subtotal: (response.data as any)?.subtotal,
                error: response.error,
            });

            if (response.success && response.data) {
                const cartResponse = response.data as CartResponse;
                setCart(cartResponse.cart);
                setCartSubtotal(cartResponse.subtotal ?? 0);
                setBaseSubtotal(cartResponse.baseSubtotal ?? 0);
                setAddonsSubtotal(cartResponse.addonsSubtotal ?? 0);
            } else {
                const cartError = response.error || 'Failed to fetch cart';
                console.warn(`[useCart:${callId}] response not success:`, cartError);
                // Avoid sticky error banners during auth token propagation races.
                if (cartError.toLowerCase().includes('token')) {
                    setError(null);
                } else {
                    setError(cartError);
                }
                setCart(null);
            }
        } catch (err) {
            console.error(`[useCart:${callId}] exception:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            if (errorMessage.toLowerCase().includes('token')) {
                setError(null);
            } else {
                setError(errorMessage);
            }
            setCart(null);
        } finally {
            if (setLoadingState) {
                setLoading(false);
            }
            console.log(`[useCart:${callId}] fetchCart end`);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchCart(true);
    }, [fetchCart]);

    // Recover automatically if initial cart fetch ran before auth token was fully available.
    useEffect(() => {
        if (cart || getAuthToken()) return;

        let attempts = 0;
        const intervalId = window.setInterval(() => {
            attempts += 1;
            if (getAuthToken()) {
                void fetchCart(false);
                window.clearInterval(intervalId);
                return;
            }
            if (attempts >= 20) {
                window.clearInterval(intervalId);
            }
        }, 150);

        return () => window.clearInterval(intervalId);
    }, [cart, fetchCart]);

    // Update cart item quantity (optimistic update)
    const updateQuantity = useCallback(async (itemId: string, quantity: number): Promise<boolean> => {
        if (quantity < 1 || !cart) {
            return false;
        }

        // Store previous state for rollback
        const previousCart = cart;

        // Optimistic update: update local state immediately
        setCart((prevCart) => {
            if (!prevCart) return null;
            return {
                ...prevCart,
                items: prevCart.items.map((item) =>
                    item.id === itemId ? { ...item, quantity } : item
                ),
            };
        });

        try {
            setUpdatingItemId(itemId);
            const response = await updateCartItem(itemId, { quantity });

            if (response.success) {
                // Success - state is already updated, no need to refetch
                setUpdatingItemId(null);
                return true;
            } else {
                // Error - rollback to previous state
                setCart(previousCart);
                setError(response.error || 'Failed to update cart item');
                setUpdatingItemId(null);
                return false;
            }
        } catch (err) {
            // Error - rollback to previous state
            setCart(previousCart);
            const errorMessage = err instanceof Error ? err.message : 'Failed to update cart item';
            setError(errorMessage);
            setUpdatingItemId(null);
            return false;
        }
    }, [cart]);

    // Remove cart item (optimistic update)
    const removeItem = useCallback(async (itemId: string): Promise<boolean> => {
        if (!cart) {
            return false;
        }

        // Store previous state for rollback
        const previousCart = cart;

        // Optimistic update: remove item from local state immediately
        setCart((prevCart) => {
            if (!prevCart) return null;
            return {
                ...prevCart,
                items: prevCart.items.filter((item) => item.id !== itemId),
            };
        });

        try {
            setRemovingItemId(itemId);
            const response = await removeFromCart(itemId);

            if (response.success) {
                // Success - state is already updated, no need to refetch
                setRemovingItemId(null);
                return true;
            } else {
                // Error - rollback to previous state
                setCart(previousCart);
                setError(response.error || 'Failed to remove cart item');
                setRemovingItemId(null);
                return false;
            }
        } catch (err) {
            // Error - rollback to previous state
            setCart(previousCart);
            const errorMessage = err instanceof Error ? err.message : 'Failed to remove cart item';
            setError(errorMessage);
            setRemovingItemId(null);
            return false;
        }
    }, [cart]);

    // Clear entire cart
    const clearCartItems = useCallback(async (): Promise<boolean> => {
        try {
            const response = await clearCart();

            if (response.success) {
                setCart(null);
                return true;
            } else {
                setError(response.error || 'Failed to clear cart');
                return false;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to clear cart';
            setError(errorMessage);
            return false;
        }
    }, []);

    // Computed values
    const items = useMemo(() => {
        const next = cart?.items || [];
        console.log(`[useCart] items memo recomputed, count=${next.length}`);
        return next;
    }, [cart]);

    const itemCount = useMemo(() => {
        return items.reduce((sum, item) => sum + item.quantity, 0);
    }, [items]);

    const total = useMemo(() => {
        if (cartSubtotal && cartSubtotal > 0) {
            return cartSubtotal;
        }

        // Fallback: compute from items (base + addons) if backend subtotal not available
        return items.reduce((sum, item: any) => {
            if (item.pricing) {
                return sum + Number(item.pricing.total || 0);
            }

            const price = item.product?.sellingPrice || item.product?.basePrice || 0;
            const variantModifier = item.variant?.priceModifier || 0;
            const itemPrice = Number(price) + Number(variantModifier);
            return sum + itemPrice * item.quantity;
        }, 0);
    }, [cartSubtotal, items]);

    // Helper method to check if a product is already in cart
    const isProductInCart = useCallback((productName: string): boolean => {
        return items.some(item => item.product?.name === productName);
    }, [items]);

    const refetch = useCallback(async () => {
        await fetchCart(true);
    }, [fetchCart]);

    return {
        cart,
        items,
        loading,
        error,
        updatingItemId,
        removingItemId,
        total,
        baseSubtotal,
        addonsSubtotal,
        itemCount,
        refetch,
        updateQuantity,
        removeItem,
        clearCartItems,
        isProductInCart,
    };
}
