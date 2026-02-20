"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "../components/Breadcrumbs";
import CartItem from "../components/CartItem";
import BillingSummary from "../components/BillingSummary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useCart } from "@/contexts/CartContext";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { toastError, toastWarning, toastSuccess, toastPromise } from "@/lib/utils/toast";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { uploadOrderFilesToS3 } from "@/lib/api/uploads";
import { updateCartItem } from "@/lib/api/cart";

function CartPageContent() {
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
    const shippingFee = 15; // Same as checkout for now

    const tax = useMemo(() => {
        const taxableAmount = subtotal || 0;
        return taxableAmount * 0.18;
    }, [subtotal]);

    const grandTotal = useMemo(() => {
        return (subtotal || 0) + shippingFee + tax;
    }, [subtotal, shippingFee, tax]);


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

    // Helper function to check if item has images
    const itemHasImages = (item: typeof items[0]): boolean => {
        if (!item.customDesignUrl) return false;

        if (Array.isArray(item.customDesignUrl)) {
            return item.customDesignUrl.length > 0 &&
                item.customDesignUrl.some(url => url && url.trim() !== '');
        }

        return typeof item.customDesignUrl === 'string' &&
            item.customDesignUrl.trim() !== '';
    };

    // Check if all selected items have images
    const allSelectedItemsHaveImages = useMemo(() => {
        if (selectedItemsList.length === 0) return false;

        return selectedItemsList.every(item => itemHasImages(item));
    }, [selectedItemsList]);

    const handleGoToCheckout = () => {
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
                    customDesignUrl: allUrls.join(','),
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
        <div className="min-h-screen py-8">
            {ConfirmDialog}
            <div className="max-w-7xl mx-auto px-6">
                {/* Breadcrumbs */}
                <Breadcrumbs items={breadcrumbs} />

                <h1 className="text-3xl font-hkgb font-bold text-gray-900 mb-6">YOUR CART</h1>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6 mb-6">
                        <p className="text-red-600 text-sm">{error}</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium underline cursor-pointer"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <BarsSpinner />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Cart Items */}
                        <div className="lg:col-span-2">
                            {/* Select All / Unselect All */}
                            {items.length > 0 && (
                                <div className="mb-4 flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleSelectAll}
                                            disabled={selectedItems.size === items.length}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedItems.size === items.length
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                }`}
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={handleUnselectAll}
                                            disabled={selectedItems.size === 0}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedItems.size === 0
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            Unselect All
                                        </button>
                                    </div>
                                    <span className="text-sm text-gray-600">
                                        {selectedItems.size} of {items.length} items selected
                                    </span>
                                </div>
                            )}

                            {items.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center">
                                    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gray-50 flex items-center justify-center">
                                        <ShoppingCart className="text-gray-400 w-8 h-8" strokeWidth={1.5} />
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</p>
                                    <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                                        Looks like you haven't added anything to your cart yet. Start shopping to add items.
                                    </p>
                                    <Link
                                        href="/products"
                                        className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-[#008ECC] active:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow font-medium"
                                    >
                                        Continue Shopping
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4 border border-gray-100 rounded-2xl p-4 pb-0">
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
                            <div className="lg:col-span-1">
                                <BillingSummary
                                    mrp={mrp || 0}
                                    subtotal={baseSubtotal || 0}
                                    addonsSubtotal={addonsSubtotal || 0}
                                    discount={discount}
                                    couponApplied={couponApplied}
                                    shipping={shippingFee}
                                    tax={tax}
                                    grandTotal={grandTotal}
                                    itemCount={selectedItemsList.length}
                                    showCheckoutActions={false}
                                />
                                <button
                                    onClick={handleGoToCheckout}
                                    disabled={selectedItems.size === 0 || !allSelectedItemsHaveImages}
                                    className={`w-full mt-4 px-6 py-3 rounded-2xl text-white transition-colors font-medium ${selectedItems.size > 0 && allSelectedItemsHaveImages
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
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CartPage() {
    return (
        <ProtectedRoute>
            <CartPageContent />
        </ProtectedRoute>
    );
}
