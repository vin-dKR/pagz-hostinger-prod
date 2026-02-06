'use client';

import React, { createContext, useContext, useReducer, ReactNode, useCallback, useMemo } from 'react';
import { ProductConfiguration, ProductData } from '@/types/index';

type ProductConfigAction =
    | { type: 'UPDATE_CATEGORY'; payload: ProductConfiguration['category'] }
    | { type: 'UPDATE_SIZE'; payload: string }
    | { type: 'UPDATE_PAPER_TYPE'; payload: string }
    | { type: 'UPDATE_COLOR'; payload: string }
    | { type: 'UPDATE_SIDES'; payload: string }
    | { type: 'UPDATE_BINDING'; payload: string }
    | { type: 'UPDATE_LAMINATION'; payload: string }
    | { type: 'UPDATE_QUANTITY'; payload: number }
    | { type: 'UPDATE_CUSTOM_OPTION'; payload: { key: string; value: any } }
    | { type: 'RESET_CONFIGURATION' };

interface ProductConfigContextType {
    configuration: ProductConfiguration;
    dispatch: React.Dispatch<ProductConfigAction>;
    calculatePrice: (productData: ProductData) => number;
}

const ProductConfigContext = createContext<ProductConfigContextType | undefined>(undefined);

const initialState: ProductConfiguration = {
    category: 'pdf-printing',
    size: undefined,
    paperType: undefined,
    colorType: undefined,
    sides: undefined,
    binding: undefined,
    lamination: undefined,
    quantity: 1,
    customOptions: {},
};

function productConfigReducer(
    state: ProductConfiguration,
    action: ProductConfigAction
): ProductConfiguration {
    switch (action.type) {
        case 'UPDATE_CATEGORY':
            return { ...initialState, category: action.payload };

        case 'UPDATE_SIZE':
            return { ...state, size: action.payload };

        case 'UPDATE_PAPER_TYPE':
            return { ...state, paperType: action.payload };

        case 'UPDATE_COLOR':
            return { ...state, colorType: action.payload };

        case 'UPDATE_SIDES':
            return { ...state, sides: action.payload };

        case 'UPDATE_BINDING':
            return { ...state, binding: action.payload };

        case 'UPDATE_LAMINATION':
            return { ...state, lamination: action.payload };

        case 'UPDATE_QUANTITY':
            return { ...state, quantity: action.payload };

        case 'UPDATE_CUSTOM_OPTION':
            return {
                ...state,
                customOptions: {
                    ...state.customOptions,
                    [action.payload.key]: action.payload.value,
                },
            };

        case 'RESET_CONFIGURATION':
            return initialState;

        default:
            return state;
    }
}

export function ProductConfigProvider({ children }: { children: ReactNode }) {
    const [configuration, dispatch] = useReducer(productConfigReducer, initialState);

    const calculatePrice = useCallback((productData: ProductData): number => {
        let totalPrice = productData.basePrice || 0;

        // Calculate based on selections
        if (configuration.paperType && productData.options.paperTypes) {
            const paperType = productData.options.paperTypes.find(
                p => p.value === configuration.paperType
            );
            if (paperType?.price) {
                totalPrice += paperType.price;
            }
        }
        return totalPrice * configuration.quantity;
    }, [configuration]);

    const value = useMemo(() => ({
        configuration,
        dispatch,
        calculatePrice,
    }), [configuration, calculatePrice]);


    return (
        <ProductConfigContext.Provider value={value}>
            {children}
        </ProductConfigContext.Provider>
    );
}

export function useProductConfig() {
    const context = useContext(ProductConfigContext);
    if (context === undefined) {
        throw new Error('useProductConfig must be used within a ProductConfigProvider');
    }
    return context;
}
