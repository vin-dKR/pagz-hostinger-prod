"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { createRazorpayOrderFromCart, verifyRazorpayPayment } from "@/lib/api/payments";
import CheckoutFilesReview from "../components/CheckoutFilesReview";
import { toastWarning, toastError, toastSuccess, toastPromise } from "@/lib/utils/toast";

function CheckoutPageContent() {
    const searchParams = useSearchParams();
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
        tax: allTax,
        grandTotal: allGrandTotal,
        loading,
        error,
    } = useCheckout();

    const { removeItem } = useCart();
    const [isPaying, setIsPaying] = useState(false);

    // Get selected item IDs from URL params
    const selectedItemIds = useMemo(() => {
        const itemsParam = searchParams.get('items');
        if (!itemsParam) return null;
        return new Set(itemsParam.split(',').filter(Boolean));
    }, [searchParams]);

    // Filter cart items to only show selected items
    const cartItems = useMemo(() => {
        if (!selectedItemIds) {
            // If no selection, show all items (backward compatibility)
            return allCartItems;
        }
        return allCartItems.filter(item => selectedItemIds.has(item.id));
    }, [allCartItems, selectedItemIds]);

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

    // Recalculate tax and total with selected shipping (for selected items only)
    const calculatedTax = useMemo(() => {
        const taxableAmount = (subtotal || 0) - discountAmount;
        return taxableAmount * 0.18;
    }, [subtotal, discountAmount]);

    const calculatedTotal = useMemo(() => {
        return (subtotal || 0) - discountAmount + selectedShippingFee + calculatedTax;
    }, [subtotal, discountAmount, selectedShippingFee, calculatedTax]);

    async function loadRazorpayScript(): Promise<boolean> {
        if (typeof window === "undefined") return false;
        if ((window as any).Razorpay) return true;

        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }

    const handlePay = async () => {
        if (!selectedAddressId) {
            toastWarning("Please select a delivery address before proceeding to payment.");
            return;
        }

        if (cartItems.length === 0) {
            toastWarning("Your cart is empty.");
            return;
        }

        try {
            setIsPaying(true);

            // 1) Create Razorpay order directly from cart (order created in DB only after payment success)
            const rpOrderResp = await createRazorpayOrderFromCart({
                items: cartItems.map((item: any) => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    customDesignUrl: item.customDesignUrl,
                    customText: item.customText,
                    metadata:
                        item.metadata && Array.isArray(item.metadata.priceBreakdown)
                            ? item.metadata
                            : undefined,
                })),
                addressId: selectedAddressId,
                amount: calculatedTotal,
                couponCode: appliedCoupon?.coupon?.code,
                shippingCharges: selectedShippingFee,
            });

            if (!rpOrderResp.success || !rpOrderResp.data) {
                throw new Error(rpOrderResp.error || "Failed to create Razorpay order");
            }

            const rpData = rpOrderResp.data;

            // 2) Load Razorpay checkout
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                throw new Error("Failed to load Razorpay checkout script");
            }

            const options: any = {
                key: rpData.key,
                amount: Math.round(rpData.amount * 100), // in paise
                currency: rpData.currency,
                name: "Custom Printing Store",
                description: `Order payment`,
                order_id: rpData.razorpayOrderId,
                handler: async (response: any) => {
                    try {
                        // 3) Verify payment and create order in DB
                        const verifyResp = await toastPromise(
                            verifyRazorpayPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                            {
                                loading: 'Verifying payment...',
                                success: 'Payment verified successfully!',
                                error: 'Payment verification failed. Please contact support if amount was deducted.',
                            }
                        );

                        if (!verifyResp.success || !verifyResp.data || !verifyResp.data.verified) {
                            toastError("Payment verification failed. If amount was deducted, please contact support.");
                            return;
                        }

                        const orderId = verifyResp.data.orderId;

                        // Files are already uploaded to S3 and stored in cart items
                        // Order items are created with S3 URLs from cart items during payment verification

                        // Clear buyNow data from sessionStorage if it exists
                        if (typeof window !== 'undefined' && sessionStorage.getItem('buyNow')) {
                            sessionStorage.removeItem('buyNow');
                        }

                        // Remove only ordered items from cart (not the entire cart)
                        // Skip if this was a buyNow order (no cart items to remove)
                        if (cartItems.some(item => item.id !== 'buy-now-temp')) {
                            try {
                                // Remove each ordered item from cart
                                const removePromises = cartItems
                                    .filter(item => item.id !== 'buy-now-temp')
                                    .map(item => removeItem(item.id));
                                await Promise.all(removePromises);
                            } catch (clearError) {
                                console.error("Failed to remove ordered items from cart:", clearError);
                                // Don't block the redirect if removal fails
                            }
                        }

                        toastSuccess('Order placed successfully!');
                        setTimeout(() => {
                            window.location.href = `/orders/${orderId}`;
                        }, 1500);
                    } catch (err) {
                        console.error("Failed to verify payment", err);
                        toastError("Payment verification failed. If amount was deducted, please contact support.");
                    }
                },
                theme: {
                    color: "#008ECC",
                },
            };

            const rz = new (window as any).Razorpay(options);
            rz.open();
        } catch (err) {
            console.error("Payment error", err);
            const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
            toastError(message);
        } finally {
            setIsPaying(false);
        }
    };

    const breadcrumbs = [
        { label: "Home", href: "/" },
        { label: "Cart", href: "/cart" },
        { label: "Checkout", href: "/checkout" },
    ];

    if (loading) {
        return (
            <div className="min-h-screen py-8 flex items-center justify-center">
                <BarsSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen py-8">
                <div className="max-w-7xl mx-auto px-6">
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
                <div className="max-w-7xl mx-auto px-6">
                    <Breadcrumbs items={breadcrumbs} />
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-600 text-lg mb-4">Your cart is empty</p>
                        <a
                            href="/products"
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
            <div className="max-w-7xl mx-auto px-6">
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
                            tax={calculatedTax || 0}
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
