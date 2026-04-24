"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Truck, Zap, Package, Plane, Ship, Rocket } from "lucide-react";
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
import { getShippingMethods } from "@/lib/api/shipping";
import CheckoutFilesReview from "../components/CheckoutFilesReview";
import { toastWarning, toastError } from "@/lib/utils/toast";
import {
    computeCategoryShortfalls,
    formatInr,
} from "@/lib/utils/category-min-cart-value";

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

    // Fetch shipping methods from API
    const {
        data: shippingMethodsResponse,
        isLoading: isShippingLoading,
        isError: isShippingError,
        refetch: refetchShippingMethods,
    } = useQuery({
        queryKey: ['shipping-methods'],
        queryFn: getShippingMethods,
        staleTime: 60_000,
    });

    const shippingMethods = useMemo(
        () => shippingMethodsResponse?.data?.methods ?? [],
        [shippingMethodsResponse]
    );

    // Track selected shipping method
    const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);

    // Map icon string to lucide icon component; null/empty/unknown => render nothing
    const renderIcon = (iconName?: string | null, iconColor?: string | null) => {
        const style = iconColor ? { color: iconColor } : undefined;
        const className = iconColor ? "" : "text-blue-600";
        const key = (iconName || "").toLowerCase();
        switch (key) {
            case "truck":
                return <Truck size={40} className={className} style={style} />;
            case "zap":
                return <Zap size={40} className={className} style={style} />;
            case "package":
                return <Package size={40} className={className} style={style} />;
            case "plane":
                return <Plane size={40} className={className} style={style} />;
            case "ship":
                return <Ship size={40} className={className} style={style} />;
            case "rocket":
                return <Rocket size={40} className={className} style={style} />;
            default:
                return null;
        }
    };

    // Derive shipping options to pass into ShippingMethod component
    const shippingOptions = useMemo(() => {
        return shippingMethods.map((method) => ({
            id: method.id,
            name: method.name,
            price: Number(method.price) || 0,
            description: method.description || method.estimatedDays || "",
            icon: renderIcon(method.icon, method.iconColor),
        }));
    }, [shippingMethods]);

    // Default selection: isDefault method, else first, else null.
    // Also re-select default if current selection is no longer in the list.
    useEffect(() => {
        if (shippingMethods.length === 0) {
            if (selectedShippingId !== null) {
                setSelectedShippingId(null);
            }
            return;
        }

        const stillValid = selectedShippingId
            ? shippingMethods.some((m) => m.id === selectedShippingId)
            : false;

        if (!stillValid) {
            const defaultMethod = shippingMethods.find((m) => m.isDefault);
            const nextId = defaultMethod?.id ?? shippingMethods[0]?.id ?? null;
            setSelectedShippingId(nextId);
        }
    }, [shippingMethods, selectedShippingId]);

    // Calculate selected shipping fee from the selected method
    const selectedShippingFee = useMemo(() => {
        if (!selectedShippingId) return 0;
        const selectedMethod = shippingMethods.find((m) => m.id === selectedShippingId);
        return selectedMethod ? Number(selectedMethod.price) || 0 : 0;
    }, [selectedShippingId, shippingMethods]);

    const hasNoShippingMethods = !isShippingLoading && !isShippingError && shippingMethods.length === 0;
    const requiresShippingSelection = shippingOptions.length > 0 && !selectedShippingId;

    // Per-category minimum cart value: prevent payment if any category for the
    // items being checked out is below its configured minimum. The API
    // re-validates (see createOrder), but we fail fast in the UI so the user
    // isn't surprised by a 400 after opening Razorpay.
    const categoryShortfalls = useMemo(
        () => computeCategoryShortfalls(cartItems),
        [cartItems]
    );
    const hasCategoryShortfall = categoryShortfalls.length > 0;

    // Recalculate total with selected shipping (for selected items only).
    // Clamp at 0 so an oversized fixed-amount discount never surfaces a
    // negative payable in the billing summary or the Pay button.
    const calculatedTotal = useMemo(() => {
        return Math.max(0, (subtotal || 0) - discountAmount + selectedShippingFee);
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

        if (hasNoShippingMethods) {
            toastWarning("No shipping methods available right now. Please contact support.");
            return;
        }

        if (requiresShippingSelection) {
            toastWarning("Please select a shipping method.");
            return;
        }

        if (hasCategoryShortfall) {
            const firstShortfall = categoryShortfalls[0];
            if (firstShortfall) {
                const diff = Math.max(0, firstShortfall.required - firstShortfall.current);
                toastError(
                    `Add ${formatInr(diff)} more to "${firstShortfall.categoryName}" to reach its minimum of ${formatInr(firstShortfall.required)}.`
                );
            } else {
                toastError("Some categories are below the minimum cart value.");
            }
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
                shippingMethodId: selectedShippingId,
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
            // Surface per-category shortfall details (server rejected the order
            // because one or more categories are below their minimum).
            const details = (err as { details?: { shortfalls?: Array<{ categoryName: string; required: number; current: number }> } } | undefined)?.details;
            const shortfalls = details?.shortfalls;
            const firstShortfall = Array.isArray(shortfalls) ? shortfalls[0] : undefined;
            if (firstShortfall) {
                const diff = Math.max(0, firstShortfall.required - firstShortfall.current);
                toastError(
                    `Minimum not met for "${firstShortfall.categoryName}": add ${formatInr(diff)} (required ${formatInr(firstShortfall.required)}).`
                );
            } else {
                const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
                toastError(message);
            }
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
                        {isShippingError ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
                                <p className="text-red-600 text-sm">
                                    Failed to load shipping methods. Please try again.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void refetchShippingMethods()}
                                    className="text-sm font-medium text-red-700 hover:text-red-800 underline"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : isShippingLoading ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                                <h2 className="text-xl font-hkgb font-bold text-gray-900 mb-6">Shipping Method</h2>
                                <div className="space-y-3">
                                    <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                                    <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                                </div>
                            </div>
                        ) : hasNoShippingMethods ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-600 text-sm">
                                    No shipping methods available right now. Please contact support.
                                </p>
                            </div>
                        ) : (
                            <ShippingMethod
                                options={shippingOptions}
                                selectedId={selectedShippingId ?? undefined}
                                onSelect={setSelectedShippingId}
                            />
                        )}

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

                        {hasCategoryShortfall && (
                            <div
                                role="alert"
                                className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
                            >
                                <p className="text-sm font-semibold mb-2">
                                    Minimum order value not met
                                </p>
                                <ul className="space-y-1.5 text-sm">
                                    {categoryShortfalls.map((s) => {
                                        const diff = Math.max(0, s.required - s.current);
                                        return (
                                            <li key={s.categoryId}>
                                                <span className="font-medium">{s.categoryName}</span>:{' '}
                                                current {formatInr(s.current)} / required{' '}
                                                {formatInr(s.required)}{' '}
                                                <span className="text-amber-800">
                                                    (add {formatInr(diff)})
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

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
                            disabled={hasNoShippingMethods || requiresShippingSelection || hasCategoryShortfall}
                            disabledMessage={
                                hasNoShippingMethods
                                    ? "No shipping methods available right now. Please contact support."
                                    : requiresShippingSelection
                                        ? "Select a shipping method"
                                        : hasCategoryShortfall
                                            ? "Some categories are below the minimum cart value"
                                            : undefined
                            }
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
