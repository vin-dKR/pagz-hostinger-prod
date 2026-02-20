/**
 * useCheckout Hook
 * Manages checkout data and operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAddresses } from '@/hooks/addresses/useAddresses';
import { validateCoupon, getAvailableCoupons, type Coupon, type ValidateCouponResponse } from '@/lib/api/coupons';
import { Address } from '@/lib/api/addresses';

export interface UseCheckoutReturn {
    // Cart data
    cartItems: any[];
    mrp: number;
    subtotal: number;
    deliveryFee: number;
    itemCount: number;

    // Address data
    addresses: Address[];
    defaultAddress: Address | null;
    selectedAddressId: string | null;
    setSelectedAddressId: (id: string | null) => void;
    addressLoading: boolean;
    addressError: string | null;

    // Coupon data
    availableCoupons: Coupon[];
    appliedCoupon: ValidateCouponResponse | null;
    couponCode: string;
    setCouponCode: (code: string) => void;
    discountAmount: number;
    isApplyingCoupon: boolean;
    couponError: string | null;
    applyCoupon: () => Promise<boolean>;
    removeCoupon: () => void;

    // Calculated totals
    tax: number;
    grandTotal: number;

    // Loading states
    loading: boolean;
    error: string | null;
}

export function useCheckout(): UseCheckoutReturn {
    // Check for direct buy now data in sessionStorage
    const [buyNowData, setBuyNowData] = useState<any | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem('buyNow');
            if (stored) {
                try {
                    setBuyNowData(JSON.parse(stored));
                } catch (err) {
                    console.error('Failed to parse buyNow data:', err);
                    sessionStorage.removeItem('buyNow');
                }
            }
        }
    }, []);

    // Cart hook (only used if not buyNow)
    const {
        items: cartItems,
        itemCount,
        loading: cartLoading,
        error: cartError,
    } = useCart();

    // Fixed delivery fee (can be calculated based on subtotal or location)
    const deliveryFee = 15;

    // Use buyNow data if available, otherwise use cart
    const effectiveCartItems = useMemo(() => {
        if (buyNowData && buyNowData.product) {
            // Convert buyNow data to cart item format
            return [{
                id: 'buy-now-temp',
                productId: buyNowData.productId,
                product: buyNowData.product,
                quantity: buyNowData.quantity || 1,
                variantId: buyNowData.variantId || null,
                variant: buyNowData.variantId ? buyNowData.product.variants?.find((v: any) => v.id === buyNowData.variantId) : null,
                customDesignUrl: buyNowData.customDesignUrl || [],
                customText: buyNowData.customText || null,
                metadata: buyNowData.metadata || {
                    pageCount: buyNowData.pageCount,
                    copies: buyNowData.copies,
                    priceBreakdown: buyNowData.priceBreakdown,
                },
            }];
        }
        return cartItems;
    }, [buyNowData, cartItems]);

    // Calculate MRP (Maximum Retail Price) - sum of all MRP prices
    const mrp = useMemo(() => {
        if (buyNowData && buyNowData.product) {
            const product = buyNowData.product;
            const mrpPrice = Number(product?.mrp || 0);
            return mrpPrice * (buyNowData.quantity || 1);
        }
        return effectiveCartItems.reduce((sum, item) => {
            // Type assertion to access mrp if it exists in the product
            const product = item.product as any;
            const mrpPrice = Number(product?.mrp || 0);
            return sum + mrpPrice * item.quantity;
        }, 0);
    }, [buyNowData, effectiveCartItems]);

    // Calculate subtotal (selling price) - sum of all selling prices
    const subtotal = useMemo(() => {
        // For Buy Now, use the pre-calculated total price (includes addons if any)
        if (buyNowData && typeof buyNowData.price === 'number') {
            return buyNowData.price;
        }

        // For cart-based checkout, if metadata with priceBreakdown is present, prefer that
        return effectiveCartItems.reduce((sum, item: any) => {
            if (item.metadata && Array.isArray(item.metadata.priceBreakdown)) {
                const lineTotal = item.metadata.priceBreakdown.reduce(
                    (acc: number, entry: any) => acc + Number(entry?.value || 0),
                    0
                );
                return sum + lineTotal;
            }

            const price = Number(item.product?.sellingPrice || item.product?.basePrice || 0);
            const variantModifier = Number(item.variant?.priceModifier || 0);
            const itemPrice = price + variantModifier;
            return sum + itemPrice * item.quantity;
        }, 0);
    }, [buyNowData, effectiveCartItems]);

    // Addresses hook
    const {
        addresses,
        loading: addressLoading,
        error: addressError,
    } = useAddresses();

    // Coupon state
    const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
    const [appliedCoupon, setAppliedCoupon] = useState<ValidateCouponResponse | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Address selection
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

    // Find default address
    const defaultAddress = useMemo(() => {
        return addresses.find((addr) => addr.isDefault) || addresses[0] || null;
    }, [addresses]);

    // Set selected address to default on mount
    useEffect(() => {
        if (defaultAddress && !selectedAddressId) {
            setSelectedAddressId(defaultAddress.id);
        }
    }, [defaultAddress, selectedAddressId]);

    // Fetch available coupons
    useEffect(() => {
        const fetchCoupons = async () => {
            try {
                const response = await getAvailableCoupons();
                if (response.success && response.data) {
                    setAvailableCoupons(response.data);
                }
            } catch (err) {
                console.error('Failed to fetch coupons:', err);
            }
        };
        fetchCoupons();
    }, []);

    // Apply coupon
    const applyCoupon = useCallback(async (): Promise<boolean> => {
        if (!couponCode.trim()) {
            setCouponError('Please enter a coupon code');
            return false;
        }

        setIsApplyingCoupon(true);
        setCouponError(null);

        try {
            // Prepare cart items for validation (use effective items)
            const itemsToValidate = buyNowData ? effectiveCartItems : cartItems;
            const cartItemsForValidation = itemsToValidate
                .filter((item) => item.product) // Filter out items without products
                .map((item) => ({
                    productId: item.product!.id,
                    quantity: item.quantity,
                    price: Number(
                        item.product!.sellingPrice || item.product!.basePrice || 0
                    ),
                    categoryId: (item.product as any).category?.id || (item.product as any).categoryId,
                    productName: item.product!.name || 'Product',
                    categoryName: (item.product as any).category?.name || 'Category',
                }));

            const response = await validateCoupon({
                code: couponCode.trim().toUpperCase(),
                orderAmount: subtotal || 0,
                cartItems: cartItemsForValidation,
            });

            if (response.success && response.data) {
                const { validation, ineligibleItems } = response.data;

                // Check if partially valid
                if (validation?.isPartiallyValid) {
                    // Show warning but allow application
                    const productNames = ineligibleItems
                        ?.map((item) => item.productName)
                        .join(', ') || '';
                    setCouponError(
                        `Coupon applied to eligible items. Not valid for: ${productNames}`
                    );
                    setAppliedCoupon(response.data);
                    return true;
                } else if (validation && !validation.isValid) {
                    // No eligible items
                    const productNames = ineligibleItems
                        ?.map((item) => item.productName)
                        .join(', ') || '';
                    setCouponError(
                        `This coupon is not valid for the selected products: ${productNames}`
                    );
                    setAppliedCoupon(null);
                    return false;
                } else {
                    // Fully valid
                    setAppliedCoupon(response.data);
                    setCouponError(null);
                    return true;
                }
            } else {
                // API returned success: false with error message
                const errorMessage = response.error || response.message || 'Invalid coupon code';
                setCouponError(errorMessage);
                setAppliedCoupon(null);
                return false;
            }
        } catch (err: unknown) {
            // Extract error message from ApiError or Error object
            let errorMessage = 'Failed to apply coupon';

            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (err && typeof err === 'object' && 'message' in err) {
                // Handle ApiError object from api-client
                const apiError = err as { message?: string; error?: string };
                errorMessage = apiError.message || apiError.error || errorMessage;
            }

            setCouponError(errorMessage);
            setAppliedCoupon(null);
            return false;
        } finally {
            setIsApplyingCoupon(false);
        }
    }, [couponCode, subtotal, effectiveCartItems, buyNowData, cartItems]);

    // Remove coupon
    const removeCoupon = useCallback(() => {
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError(null);
    }, []);

    // Calculate discount amount
    const discountAmount = useMemo(() => {
        return appliedCoupon?.discountAmount || 0;
    }, [appliedCoupon]);

    // Calculate tax (18% GST for now)
    const tax = useMemo(() => {
        const taxableAmount = (subtotal || 0) - discountAmount;
        return taxableAmount * 0.18;
    }, [subtotal, discountAmount]);

    // Calculate grand total
    const grandTotal = useMemo(() => {
        return (subtotal || 0) - discountAmount + (deliveryFee || 0) + tax;
    }, [subtotal, discountAmount, deliveryFee, tax]);

    // Combined loading state
    const loading = cartLoading || addressLoading;

    // Combined error state
    const error = cartError || addressError;

    // Use effective cart items (buyNow or cart)
    const finalCartItems = buyNowData ? effectiveCartItems : cartItems;
    const finalItemCount = buyNowData ? 1 : itemCount;

    return {
        // Cart data
        cartItems: finalCartItems,
        mrp,
        subtotal,
        deliveryFee,
        itemCount: finalItemCount,

        // Address data
        addresses,
        defaultAddress,
        selectedAddressId,
        setSelectedAddressId,
        addressLoading,
        addressError,

        // Coupon data
        availableCoupons,
        appliedCoupon,
        couponCode,
        setCouponCode,
        discountAmount,
        isApplyingCoupon,
        couponError,
        applyCoupon,
        removeCoupon,

        // Calculated totals
        tax,
        grandTotal,

        // Loading states
        loading,
        error,
    };
}

