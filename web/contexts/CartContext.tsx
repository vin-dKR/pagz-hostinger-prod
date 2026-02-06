"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useCart as useCartHook, type UseCartReturn } from '@/hooks/cart/useCart';

const CartContext = createContext<UseCartReturn | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const cart = useCartHook();

    return (
        <CartContext.Provider value={cart}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart(): UseCartReturn {
    const context = useContext(CartContext);

    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }

    return context;
}

