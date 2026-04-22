"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "../components/Breadcrumbs";
import CartItem from "../components/CartItem";
import BillingSummary from "../components/BillingSummary";
import GuestCart from "../components/GuestCart";
import PendingMergeBanner from "../components/PendingMergeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { toastError, toastWarning, toastSuccess, toastPromise } from "@/lib/utils/toast";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { uploadOrderFilesToS3 } from "@/lib/api/uploads";
import { updateCartItem } from "@/lib/api/cart";
import { redirectGuestToLoginForCheckout } from "@/lib/utils/guest-cart";

function CartPageContent() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const {
        cart,
        items,
        loading,
        error,
        updatingItemId,
        removingItemId,
        total,
        updateQuantity,
        removeItem,
        refetch,
    } = useCart();

    const { confirm, ConfirmDialog } = useConfirm();
    const router = useRouter();

    // Selection state - track which items are selected
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    // Track which item is currently uploading images
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
    // Track if we've initialized selection (to prevent re-selecting after unselect all)
    const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

    // Select all items by default on initial mount only
    useEffect(() => {
        if (items.length > 0 && !hasInitializedSelection && selectedItems.size === 0) {
            setSelectedItems(new Set(items.map(item => item.id)));
            setHasInitializedSelection(true);
        }
    }, [items, hasInitializedSelection, selectedItems.size]);

    // Filter selected items
    const selectedItemsList = useMemo(() => {
        return items.filter(item => selectedItems.has(item.id));
    }, [items, selectedItems]);

    // Calculate MRP (Maximum Retail Price) for selected items only
    const mrp = useMemo(() => {
        return selectedItemsList.reduce((sum, item) => {
            const product = item.product as any;
            const mrpPrice = Number(product?.mrp || 0);
            return sum + mrpPrice * item.quantity;
        }, 0);
    }, [selectedItemsList]);

    // Calculate base & addon subtotals for selected items only
    const { baseSubtotal, addonsSubtotal, subtotal } = useMemo(() => {
        let base = 0;
        let addons = 0;

        for (const item of selectedItemsList as any[]) {
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
    }, [selectedItemsList]);

    // Cart-level billing values (no extra discount/coupon on cart page)
    const discount = 0;
    const couponApplied = 0;
    const shippingFee = 0; // Same as checkout for now

    const grandTotal = useMemo(() => {
        return (subtotal || 0) + shippingFee;
    }, [subtotal, shippingFee]);


    const handleQuantityChange = async (id: string, quantity: number) => {
        if (quantity < 1) {
            return;
        }
        const success = await updateQuantity(id, quantity);
        if (!success) {
            toastError('Failed to update cart item. Please try again.');
        }
    };

    const handleRemoveItem = async (id: string) => {
        const confirmed = await confirm({
            title: 'Remove Item',
            description: 'Are you sure you want to remove this item from your cart?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                const success = await removeItem(id);
                if (!success) {
                    toastError('Failed to remove item from cart. Please try again.');
                } else {
                    // Remove from selection if it was selected
                    setSelectedItems(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }
            },
        });
    };

    const handleSelectChange = (id: string, selected: boolean) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(id);
            } else {
                // Allow unselecting all items (removed restriction)
                next.delete(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        // Always select all items
        setSelectedItems(new Set(items.map(item => item.id)));
    };

    const handleUnselectAll = () => {
        // Allow unselecting all items
        setSelectedItems(new Set());
    };

    // Helper function to check if item has images or template form data
    const itemHasImages = (item: typeof items[0]): boolean => {
        // Check for uploaded design files
        if (item.customDesignUrl) {
        if (Array.isArray(item.customDesignUrl)) {
                if (item.customDesignUrl.length > 0 &&
                    item.customDesignUrl.some(url => url && url.trim() !== '')) {
                    return true;
                }
            } else if (typeof item.customDesignUrl === 'string' &&
                item.customDesignUrl.trim() !== '') {
                return true;
            }
        }
        
        // Check for template with form data (template form data means files not required)
        if (item.metadata?.templateId) {
            // If template has form data, consider it as having "files" (form data replaces file requirement)
            if (item.metadata?.templateFormData && Object.keys(item.metadata.templateFormData).length > 0) {
                return true;
            }
            // Also check for template form images
            if (item.metadata?.templateFormImages && item.metadata.templateFormImages.length > 0) {
                return true;
            }
            // If template preview image exists, also consider it valid
            if (item.metadata?.templatePreviewImage) {
                return true;
            }
        }
        
        return false;
    };

    // Check if all selected items have images
    const allSelectedItemsHaveImages = useMemo(() => {
        if (selectedItemsList.length === 0) return false;

        return selectedItemsList.every(item => itemHasImages(item));
    }, [selectedItemsList]);

    const handleGoToCheckout = () => {
        // If (somehow) a logged-out user reaches the server-cart checkout
        // button, defer to the guest login-and-checkout flow instead of
        // silently failing on the checkout page.
        if (!isAuthenticated) {
            redirectGuestToLoginForCheckout('/checkout');
            return;
        }

        if (selectedItems.size === 0) {
            toastWarning('Please select at least one item to checkout.');
            return;
        }

        // Check if all selected items have images
        const itemsWithoutImages = selectedItemsList.filter(item => !itemHasImages(item));

        if (itemsWithoutImages.length > 0) {
            const itemNames = itemsWithoutImages
                .map(item => item.product?.name || 'Unknown Product')
                .join(', ');

            toastError(
                `Please add design files for: ${itemNames}. ` +
                `You can upload images directly from the cart.`
            );

            // Optionally scroll to first item without images
            const firstItemId = itemsWithoutImages[0]?.id;
            if (firstItemId) {
                const element = document.getElementById(`cart-item-${firstItemId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            return;
        }

        // All items have images, proceed to checkout
        const selectedIds = Array.from(selectedItems).join(',');
        router.push(`/checkout?items=${selectedIds}`);
    };

    // Image upload handler
    const handleImageUpload = async (itemId: string, files: File[]) => {
        if (files.length === 0) return;

        setUploadingItemId(itemId);

        try {
            // Upload files to S3
            const uploadResponse = await toastPromise(
                uploadOrderFilesToS3(files),
                {
                    loading: 'Uploading images...',
                    success: 'Images uploaded successfully!',
                    error: 'Failed to upload images. Please try again.',
                }
            );

            if (!uploadResponse.success || !uploadResponse.data) {
                toastError('Failed to upload images. Please try again.');
                return;
            }

            // Get S3 keys from upload response
            const s3Keys = uploadResponse.data.files.map(f => f.key);

            // Get existing customDesignUrl from cart item
            const cartItem = items.find(item => item.id === itemId);
            if (!cartItem) {
                toastError('Cart item not found.');
                return;
            }

            // Merge with existing images (if any)
            const existingUrls = Array.isArray(cartItem.customDesignUrl)
                ? cartItem.customDesignUrl
                : cartItem.customDesignUrl
                    ? [cartItem.customDesignUrl]
                    : [];

            const allUrls = [...existingUrls, ...s3Keys];

            // Update cart item with new S3 keys
            // Backend expects string, will convert to array internally
            // Include quantity to satisfy backend validation
            const updateResponse = await toastPromise(
                updateCartItem(itemId, {
                    quantity: cartItem.quantity, // Include quantity to satisfy backend validation
                    customDesignUrl: allUrls,
                }),
                {
                    loading: 'Updating cart item...',
                    success: 'Images added successfully!',
                    error: 'Failed to update cart item. Please try again.',
                }
            );

            if (updateResponse.success) {
                // Refresh cart to show updated images
                await refetch();
                toastSuccess('Design files added successfully!');
            } else {
                toastError('Failed to update cart item. Please try again.');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            toastError('Failed to upload images. Please try again.');
        } finally {
            setUploadingItemId(null);
        }
    };

    const breadcrumbs = [
        { label: "Home", href: "/" },
        { label: "Cart", href: "/cart" },
    ];

    return (
        <div className="min-h-screen py-4 sm:py-6 lg:py-8">
            {ConfirmDialog}
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumbs */}
                <Breadcrumbs items={breadcrumbs} />

                <h1 className="text-2xl sm:text-3xl font-hkgb font-bold text-gray-900 mb-4 sm:mb-6">YOUR CART</h1>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                        <p className="text-red-600 text-sm sm:text-base">{error}</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-2 text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium underline cursor-pointer"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Post-login: if the guest->user merge failed, surface it with a retry CTA
                    instead of silently showing an empty cart. */}
                {!authLoading && isAuthenticated && <PendingMergeBanner />}

                {/* Guest cart (logged-out users see their pending purchase) */}
                {!authLoading && !isAuthenticated ? (
                    <GuestCart />
                ) : (loading || authLoading) ? (
                    <div className="flex items-center justify-center py-12">
                        <BarsSpinner />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                        {/* Left Column - Cart Items */}
                        <div className="lg:col-span-2 order-2 lg:order-1">
                            {/* Select All / Unselect All */}
                            {items.length > 0 && (
                                <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-4">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <button
                                            onClick={handleSelectAll}
                                            disabled={selectedItems.size === items.length}
                                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${selectedItems.size === items.length
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                }`}
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={handleUnselectAll}
                                            disabled={selectedItems.size === 0}
                                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${selectedItems.size === 0
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            Unselect All
                                        </button>
                                    </div>
                                    <span className="text-xs sm:text-sm text-gray-600 text-center sm:text-right">
                                        {selectedItems.size} of {items.length} items selected
                                    </span>
                                </div>
                            )}

                            {items.length === 0 ? (
                                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-6 sm:p-8 lg:p-12 text-center">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-5 rounded-full bg-gray-50 flex items-center justify-center">
                                        <ShoppingCart className="text-gray-400 w-6 h-6 sm:w-8 sm:h-8" strokeWidth={1.5} />
                                    </div>
                                    <p className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Your cart is empty</p>
                                    <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md mx-auto px-4">
                                        Looks like you haven't added anything to your cart yet. Start shopping to add items.
                                    </p>
                                    <Link
                                        href="/services"
                                        className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-500 border border-blue-600 text-white rounded-xl hover:bg-blue-600 transition-all duration-200 font-medium text-sm sm:text-base"
                                    >
                                        Continue Shopping
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4 sm:space-y-6 border border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 bg-white">
                                    {items.map((item) => (
                                        <CartItem
                                            key={item.id}
                                            item={item}
                                            onQuantityChange={handleQuantityChange}
                                            onRemove={handleRemoveItem}
                                            isUpdating={updatingItemId === item.id}
                                            isRemoving={removingItemId === item.id}
                                            isSelected={selectedItems.has(item.id)}
                                            onSelectChange={handleSelectChange}
                                            showCheckbox={true}
                                            isCheckboxDisabled={false}
                                            onImageUpload={handleImageUpload}
                                            isUploadingImages={uploadingItemId === item.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right Column - Billing Summary */}
                        {items.length > 0 && (
                            <div className="lg:col-span-1 order-1 lg:order-2">
                                <div className="sticky top-4">
                                    <BillingSummary
                                        mrp={mrp || 0}
                                        subtotal={baseSubtotal || 0}
                                        addonsSubtotal={addonsSubtotal || 0}
                                        discount={discount}
                                        couponApplied={couponApplied}
                                        shipping={shippingFee}
                                        grandTotal={grandTotal}
                                        itemCount={selectedItemsList.length}
                                        showCheckoutActions={false}
                                        hideCouponAndShipping={true}
                                    />
                                    <button
                                        onClick={handleGoToCheckout}
                                        disabled={selectedItems.size === 0 || !allSelectedItemsHaveImages}
                                        className={`w-full mt-3 sm:mt-4 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base text-white transition-colors font-medium ${selectedItems.size > 0 && allSelectedItemsHaveImages
                                            ? "bg-[#1EADD8] hover:bg-blue-700"
                                            : "bg-gray-400 cursor-not-allowed"
                                            }`}
                                    >
                                        {selectedItems.size === 0
                                            ? 'Select items to checkout'
                                            : !allSelectedItemsHaveImages
                                                ? 'Add images to all items'
                                                : `Go to Checkout (${selectedItemsList.length} ${selectedItemsList.length === 1 ? 'item' : 'items'})`
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CartPage() {
    // Note: /cart is intentionally *not* wrapped in ProtectedRoute.
    // Logged-out users see their pending purchase via <GuestCart />;
    // the auth gate has moved to the Checkout button (see
    // `redirectGuestToLoginForCheckout`).
    return <CartPageContent />;
}
