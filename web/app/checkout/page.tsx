"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Breadcrumbs from "../components/Breadcrumbs";
import BillingAddressForm from "../components/BillingAddressForm";
import ShippingMethod from "../components/ShippingMethod";
import CollapsibleSection from "../components/CollapsibleSection";
import BillingSummary from "../components/BillingSummary";
import OrderReview from "../components/OrderReview";
import DiscountCodeSection from "../components/DiscountCodeSection";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useCheckout } from "@/hooks/checkout/useCheckout";
import { useCart } from "@/contexts/CartContext";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/api/payments";
import CheckoutFilesReview from "../components/CheckoutFilesReview";
import { toastWarning, toastError } from "@/lib/utils/toast";

function CheckoutPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const {
        cartItems: allCartItems,
        mrp: allMrp,
        subtotal: allSubtotal,
        deliveryFee,
        itemCount: allItemCount,
        selectedAddressId,
        setSelectedAddressId,
        addressError,
        appliedCoupon,
        couponCode,
        setCouponCode,
        discountAmount,
        isApplyingCoupon,
        couponError,
        applyCoupon,
        removeCoupon,
        grandTotal: allGrandTotal,
        loading,
        error,
    } = useCheckout();

    const { removeItem, refetch: refetchCart } = useCart();
    const [isPaying, setIsPaying] = useState(false);
    const [isSyncingReorder, setIsSyncingReorder] = useState(false);
    const [isCompletingPayment, setIsCompletingPayment] = useState(false);

    const itemsParam = searchParams.get('items');

    const loadRazorpayScript = (): Promise<boolean> => {
        if (typeof window === "undefined") return Promise.resolve(false);
        if ((window as any).Razorpay) return Promise.resolve(true);

        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // Check if this is a buyNow flow (has buy-now-temp item)
    const isBuyNowFlow = useMemo(() => {
        return allCartItems.some(item => item.id === 'buy-now-temp');
    }, [allCartItems]);

    // Check if accessed directly without cart items or buyNow data
    useEffect(() => {
        // Only check after loading is complete
        if (loading) return;
        
        const hasItemsParam = itemsParam;
        const hasBuyNowData = typeof window !== 'undefined' && sessionStorage.getItem('buyNow');
        
        // If no items param, no buyNow data, and no cart items, redirect to cart
        // This prevents direct access to checkout without proper context
        if (!hasItemsParam && !hasBuyNowData && allCartItems.length === 0 && !isBuyNowFlow && !isCompletingPayment) {
            router.push('/cart');
        }
    }, [loading, allCartItems.length, itemsParam, router, isBuyNowFlow, isCompletingPayment]);

    // Get selected item IDs from URL params
    const selectedItemIds = useMemo(() => {
        if (!itemsParam) return null;
        return new Set(itemsParam.split(',').filter(Boolean));
    }, [itemsParam]);

    // Reorder flow lands on checkout with ?items=. Force-refresh cart context before empty-state checks.
    useEffect(() => {
        if (!itemsParam) return;
        let cancelled = false;
        const syncCart = async () => {
            setIsSyncingReorder(true);
            try {
                await refetchCart();
            } finally {
                if (!cancelled) {
                    setIsSyncingReorder(false);
                }
            }
        };

        void syncCart();
        return () => {
            cancelled = true;
        };
    }, [itemsParam, refetchCart]);

    // Filter cart items to only show selected items
    // If buyNow flow, ignore URL params and show all items (buyNow item)
    const cartItems = useMemo(() => {
        // If buyNow flow, always show all items (don't filter by URL params)
        if (isBuyNowFlow) {
            return allCartItems;
        }
        
        if (!selectedItemIds) {
            // If no selection, show all items (backward compatibility)
            return allCartItems;
        }
        
        // Filter by selected item IDs
        const filtered = allCartItems.filter(item => selectedItemIds.has(item.id));
        
        // If filtering resulted in empty array but we have items, 
        // it means URL params don't match - show all items instead
        if (filtered.length === 0 && allCartItems.length > 0) {
            console.warn('[checkout] URL params do not match any cart items, showing all items');
            return allCartItems;
        }
        
        return filtered;
    }, [allCartItems, selectedItemIds, isBuyNowFlow]);

    // Recalculate totals for selected items only
    const mrp = useMemo(() => {
        return cartItems.reduce((sum, item) => {
            const product = item.product as any;
            const mrpPrice = Number(product?.mrp || 0);
            return sum + mrpPrice * item.quantity;
        }, 0);
    }, [cartItems]);

    const { baseSubtotal, addonsSubtotal, subtotal } = useMemo(() => {
        let base = 0;
        let addons = 0;

        for (const item of cartItems as any[]) {
            if (item.pricing) {
                base += Number(item.pricing.baseTotal || 0);
                addons += Number(item.pricing.addonTotal || 0);
            } else {
                const price = Number(item.product?.sellingPrice || item.product?.basePrice || 0);
                const variantModifier = Number(item.variant?.priceModifier || 0);
                const itemPrice = price + variantModifier;
                base += itemPrice * item.quantity;
            }
        }

        return {
            baseSubtotal: base,
            addonsSubtotal: addons,
            subtotal: base + addons,
        };
    }, [cartItems]);

    const itemCount = cartItems.length;

    // Track selected shipping method
    const [selectedShippingId, setSelectedShippingId] = useState<string>("standard");


    const shippingOptions = [
        {
            id: "standard",
            name: "Standard Delivery",
            price: deliveryFee || 0,
            description: "5 - 7 business days",
            icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
            ),
        },
        {
            id: "express",
            name: "Express Delivery",
            price: (deliveryFee || 0) + 50,
            description: "2 - 3 business days",
            icon: (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
            ),
        },
    ];

    // Calculate selected shipping fee
    const selectedShippingFee = useMemo(() => {
        const selectedOption = shippingOptions.find(option => option.id === selectedShippingId);
        return selectedOption?.price || deliveryFee;
    }, [selectedShippingId, shippingOptions, deliveryFee]);

    // Recalculate total with selected shipping (for selected items only)
    const calculatedTotal = useMemo(() => {
        return (subtotal || 0) - discountAmount + selectedShippingFee;
    }, [subtotal, discountAmount, selectedShippingFee]);

    const handlePay = async () => {
        if (!selectedAddressId) {
            toastWarning("Please select a delivery address before proceeding to payment.");
            return;
        }

        if (cartItems.length === 0) {
            toastWarning("Your cart is empty.");
            return;
        }
        if (calculatedTotal < 1) {
            toastWarning("Minimum payable amount is ₹1.00. Please increase your order total.");
            return;
        }

        try {
            setIsPaying(true);

            // Store selected cart item IDs in sessionStorage for removal after payment
            const cartItemIds = cartItems
                .filter(item => item.id !== 'buy-now-temp')
                .map(item => item.id);
            if (cartItemIds.length > 0) {
                sessionStorage.setItem('pendingCartItemIds', JSON.stringify(cartItemIds));
            }

            // Create Razorpay order
            const response = await createRazorpayOrder({
                items: cartItems.map((item: any) => {
                    // Extract addon IDs from cart item
                    let addonIds: string[] = [];
                    if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
                        addonIds = item.addons.map((addon: any) => addon.id).filter((id: any): id is string => typeof id === 'string');
                    } else if (item.metadata?.selectedAddons && Array.isArray(item.metadata.selectedAddons)) {
                        addonIds = item.metadata.selectedAddons.filter((id: any): id is string => typeof id === 'string');
                    }

                    return {
                        productId: item.productId,
                        variantId: item.variantId,
                        quantity: item.quantity,
                        customDesignUrl: item.customDesignUrl,
                        customText: item.customText,
                        addons: addonIds.length > 0 ? addonIds : undefined,
                        hasAddon: addonIds.length > 0,
                        metadata: item.metadata || undefined,
                    };
                }),
                addressId: selectedAddressId,
                amount: calculatedTotal,
                couponCode: appliedCoupon?.coupon?.code,
                shippingCharges: selectedShippingFee,
            });

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to initiate payment");
            }

            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded || !(window as any).Razorpay) {
                throw new Error("Failed to load Razorpay checkout. Please try again.");
            }

            const razorpay = new (window as any).Razorpay({
                key: response.data.keyId,
                amount: response.data.amount,
                currency: response.data.currency,
                name: "PAGZ",
                description: "Order Payment",
                order_id: response.data.razorpayOrderId,
                handler: async (rzpResponse: {
                    razorpay_order_id: string;
                    razorpay_payment_id: string;
                    razorpay_signature: string;
                }) => {
                    try {
                        const verifyResp = await verifyRazorpayPayment({
                            merchantOrderId: response.data!.merchantOrderId,
                            razorpayOrderId: rzpResponse.razorpay_order_id,
                            razorpayPaymentId: rzpResponse.razorpay_payment_id,
                            razorpaySignature: rzpResponse.razorpay_signature,
                        });

                        if (!verifyResp.success || !verifyResp.data?.verified || !verifyResp.data.orderId) {
                            throw new Error(verifyResp.error || verifyResp.data?.message || "Payment verification failed");
                        }

                        setIsCompletingPayment(true);
                        router.replace(`/orders/${verifyResp.data.orderId}`);

                        try {
                            const pendingIds = sessionStorage.getItem("pendingCartItemIds");
                            if (pendingIds) {
                                const ids: string[] = JSON.parse(pendingIds);
                                await Promise.all(ids.map((id) => removeItem(id)));
                                sessionStorage.removeItem("pendingCartItemIds");
                            }
                        } catch {
                            // Do not fail payment flow due to cart cleanup issue
                        }

                        if (typeof window !== "undefined" && sessionStorage.getItem("buyNow")) {
                            sessionStorage.removeItem("buyNow");
                        }
                    } catch (verifyErr) {
                        const verifyMessage = verifyErr instanceof Error
                            ? verifyErr.message
                            : "Failed to verify payment. Please contact support if amount was deducted.";
                        toastError(verifyMessage);
                    } finally {
                        setIsPaying(false);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setIsPaying(false);
                        toastWarning("Payment cancelled.");
                    },
                },
                theme: {
                    color: "#008ECC",
                },
            });

            razorpay.open();
        } catch (err) {
            console.error("Payment error", err);
            const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
            toastError(message);
            setIsPaying(false);
        }
    };

    const breadcrumbs = [
        { label: "Home", href: "/" },
        { label: "Cart", href: "/cart" },
        { label: "Checkout", href: "/checkout" },
    ];

    if (loading || isSyncingReorder) {
        return (
            <div className="min-h-screen py-8 flex items-center justify-center">
                <BarsSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen py-8">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (cartItems.length === 0) {
        return (
            <div className="min-h-screen py-8">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <Breadcrumbs items={breadcrumbs} />
                    <div className="bg-white rounded-lg p-12 text-center">
                        <p className="text-gray-600 text-lg mb-4">Your cart is empty</p>
                        <a
                            href="/services"
                            className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            Continue Shopping
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="py-8 mb-10 lg:mb-40">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumbs */}
                <Breadcrumbs items={breadcrumbs} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Forms */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Billing Address */}
                        <BillingAddressForm
                            selectedAddressId={selectedAddressId}
                            onAddressSelect={setSelectedAddressId}
                        />

                        {addressError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-600 text-sm">{addressError}</p>
                            </div>
                        )}

                        {/* Shipping Method */}
                        <ShippingMethod
                            options={shippingOptions}
                            selectedId={selectedShippingId}
                            onSelect={setSelectedShippingId}
                        />

                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="lg:col-span-1">
                        {/* Order Review - Collapsible */}
                        <CollapsibleSection
                            title="Order Review"
                            subtitle={`${itemCount} item${itemCount !== 1 ? "s" : ""} in cart`}
                            defaultExpanded={false}
                        >
                            <OrderReview items={cartItems} />
                        </CollapsibleSection>

                        {/* Uploaded Files Review - Show if cart items have uploaded files */}
                        {cartItems.some(item => {
                            const fileUrls = Array.isArray(item.customDesignUrl)
                                ? item.customDesignUrl
                                : (item.customDesignUrl ? [item.customDesignUrl] : []);
                            return fileUrls.length > 0;
                        }) && (
                                <CollapsibleSection
                                    title="Uploaded Files"
                                    subtitle={`Files ready for your order`}
                                    defaultExpanded={true}
                                >
                                    <CheckoutFilesReview cartItems={cartItems} />
                                </CollapsibleSection>
                            )}

                        {/* Discount Codes - Collapsible */}
                        <CollapsibleSection title="Discount Codes" defaultExpanded={false}>
                            <DiscountCodeSection
                                couponCode={couponCode}
                                setCouponCode={setCouponCode}
                                onApply={applyCoupon}
                                isApplying={isApplyingCoupon}
                                error={couponError}
                                appliedCoupon={appliedCoupon}
                                onRemove={removeCoupon}
                                subtotal={subtotal || 0}
                            />
                        </CollapsibleSection>

                        {/* Billing Summary - Expanded */}
                        <BillingSummary
                            mrp={mrp || 0}
                            subtotal={baseSubtotal || 0}
                            addonsSubtotal={addonsSubtotal || 0}
                            discount={discountAmount || 0}
                            couponApplied={appliedCoupon ? discountAmount : 0}
                            shipping={selectedShippingFee || 0}
                            grandTotal={calculatedTotal || 0}
                            itemCount={itemCount}
                            onPay={handlePay}
                            isPaying={isPaying}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <ProtectedRoute>
            <CheckoutPageContent />
        </ProtectedRoute>
    );
}
