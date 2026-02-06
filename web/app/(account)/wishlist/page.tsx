"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Heart, ShoppingCart, Trash2, Search, Package } from "lucide-react";
import { getWishlist, removeFromWishlist, WishlistItem, WishlistResponse } from "@/lib/api/wishlist";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import Image from "next/image";
import { toastError, toastSuccess, toastInfo, toastPromise } from "@/lib/utils/toast";
import { useConfirm } from "@/lib/hooks/use-confirm";

function WishlistPageContent() {
    const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        fetchWishlist();
    }, []);

    const fetchWishlist = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getWishlist();

            if (response.success && response.data) {
                const wishlistData = response.data as WishlistResponse;
                setWishlistItems(wishlistData.wishlist || []);
            } else {
                setError(response.error || 'Failed to fetch wishlist');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFromWishlist = async (productId: string) => {
        const confirmed = await confirm({
            title: 'Remove from Wishlist',
            description: 'Are you sure you want to remove this item from your wishlist?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            variant: 'default',
            onConfirm: async () => {
                try {
                    setRemovingId(productId);
                    const response = await toastPromise(
                        removeFromWishlist(productId),
                        {
                            loading: 'Removing from wishlist...',
                            success: 'Removed from wishlist',
                            error: 'Failed to remove item from wishlist',
                        }
                    );

                    if (response.success) {
                        // Remove from local state
                        setWishlistItems(prev => prev.filter(item => item.productId !== productId));
                    }
                } catch (err) {
                    toastError(err instanceof Error ? err.message : 'Failed to remove item');
                } finally {
                    setRemovingId(null);
                }
            },
        });
    };

    const filteredItems = wishlistItems.filter((item) => {
        const product = item.product;
        const searchLower = searchQuery.toLowerCase();
        return (
            searchQuery === "" ||
            product.name.toLowerCase().includes(searchLower) ||
            product.category?.name.toLowerCase().includes(searchLower) ||
            false
        );
    });

    const formatPrice = (price: number | string | null | undefined) => {
        const numPrice = typeof price === 'string' ? parseFloat(price) : (price || 0);
        if (isNaN(numPrice)) return '₹0.00';
        return `₹${numPrice.toFixed(2)}`;
    };

    return (
        <>
            {ConfirmDialog}
            {/* Main Content */}
            <div className="flex-1">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-hkgb text-gray-900 mb-2">
                        My Wishlist
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base">
                        Save your favorite products for later
                    </p>
                </div>

                {/* Search Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search Input */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search your wishlist..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6 mb-6">
                        <p className="text-red-600 text-sm">{error}</p>
                        <button
                            onClick={fetchWishlist}
                            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Wishlist Items Count */}
                {!loading && !error && (
                    <div className="mb-4">
                        <p className="text-sm text-gray-600">
                            {filteredItems.length === wishlistItems.length
                                ? `Showing ${wishlistItems.length} item${wishlistItems.length !== 1 ? 's' : ''}`
                                : `Showing ${filteredItems.length} of ${wishlistItems.length} items`}
                        </p>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <BarsSpinner />
                    </div>
                ) : filteredItems.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <Heart className="text-gray-400 w-8 h-8" />
                        </div>
                        <p className="text-lg font-hkgb text-gray-900 mb-2">
                            {searchQuery ? 'No items found' : 'Your wishlist is empty'}
                        </p>
                        <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                            {searchQuery
                                ? `No items match "${searchQuery}" in your wishlist`
                                : "Start adding products you love to your wishlist. They'll be saved here for easy access."}
                        </p>
                        {searchQuery ? (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="inline-block px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-hkgb text-sm"
                            >
                                Clear Search
                            </button>
                        ) : (
                            <Link
                                href="/products"
                                className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors font-hkgb text-sm"
                            >
                                Start Shopping
                            </Link>
                        )}
                    </div>
                ) : (
                    /* Wishlist Items Grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredItems.map((item) => {
                            const product = item.product;
                            const primaryImage = product.images?.[0]?.url || '/images/placeholder.png';
                            const productPrice = Number(product.sellingPrice || product.basePrice || 0);
                            const originalPrice = Number(product.mrp || productPrice);

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group relative"
                                >
                                    {/* Product Image */}
                                    <Link
                                        href={`/products/${product.id}`}
                                        className="block relative aspect-square bg-gray-100"
                                    >
                                        {primaryImage ? (
                                            <Image
                                                src={primaryImage}
                                                alt={product.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-12 h-12 text-gray-400" />
                                            </div>
                                        )}

                                        {/* Remove Button - Top Right */}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleRemoveFromWishlist(product.id);
                                            }}
                                            disabled={removingId === product.id}
                                            className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 z-10"
                                            title="Remove from wishlist"
                                        >
                                            {removingId === product.id ? (
                                                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>

                                        {/* Wishlist Badge */}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-[#008ECC] text-white text-xs font-medium rounded-full">
                                            <Heart className="w-3 h-3 inline mr-1 fill-current" />
                                            Saved
                                        </div>
                                    </Link>

                                    {/* Product Info */}
                                    <div className="p-4">

                                        {/* Product Name */}
                                        <Link href={`/products/${product.id}`}>
                                            <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 hover:text-[#008ECC] transition-colors">
                                                {product.name}
                                            </h3>
                                        </Link>

                                        {/* Category */}
                                        {product.category && (
                                            <p className="text-xs text-gray-500 mb-3">
                                                {product.category.name}
                                            </p>
                                        )}

                                        {/* Price */}
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-lg font-hkgb text-gray-900">
                                                {formatPrice(productPrice)}
                                            </span>
                                            {originalPrice > productPrice && (
                                                <>
                                                    <span className="text-sm text-gray-400 line-through">
                                                        {formatPrice(originalPrice)}
                                                    </span>
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                        {Math.round(((originalPrice - productPrice) / originalPrice) * 100)}% off
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/products/${product.id}`}
                                                className="flex-1 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-center"
                                            >
                                                View Details
                                            </Link>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // TODO: Add to cart functionality
                                                    toastInfo('Add to cart functionality coming soon');
                                                }}
                                                className="flex items-center justify-center gap-1 px-3 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B3] transition-colors text-sm font-medium"
                                                title="Add to cart"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Load More Button (if pagination needed) */}
                {!loading && !error && filteredItems.length > 0 && filteredItems.length < (wishlistItems.length || 0) && (
                    <div className="mt-8 text-center">
                        <button className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                            Load More Items
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

export default function WishlistPage() {
    return <WishlistPageContent />;
}

