/**
 * Product Card List View Component
 * Horizontal layout for list view mode
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { imageLoader } from "@/lib/utils/image-loader";
import { useAuth } from "@/contexts/AuthContext";
import { addToCart } from "@/lib/api/cart";
import { addToWishlist, removeFromWishlist, checkWishlist } from "@/lib/api/wishlist";
import { useCart } from "@/contexts/CartContext";
import { toastError, toastPromise } from "@/lib/utils/toast";
import { Heart, ShoppingCart, Loader2 } from "lucide-react";

interface ProductCardListProps {
    id: string;
    name: string;
    category: string;
    price: number;
    image?: string;
    description?: string;
    rating?: number;
    onAddToCart?: (id: string) => void;
}

export default function ProductCardList({
    id,
    category,
    name,
    price,
    image,
    description,
    rating,
    onAddToCart,
}: ProductCardListProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { refetch: refetchCart } = useCart();
    const { isProductInCart } = useCart();
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLoadingWishlist, setIsLoadingWishlist] = useState(false);
    const [isAddingToCart, setIsAddingToCart] = useState(false);

    // Check if product is already in cart
    const isInCart = isProductInCart(name);

    // Check wishlist status on mount
    useEffect(() => {
        if (isAuthenticated) {
            checkWishlistStatus();
        }
    }, [isAuthenticated, id]);

    const checkWishlistStatus = async () => {
        try {
            const response = await checkWishlist(id);
            if (response.success && response.data) {
                setIsFavorite(response.data.isInWishlist);
            }
        } catch (err) {
            // Silently fail - wishlist check is not critical
            console.warn('Failed to check wishlist status:', err);
        }
    };

    const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
            router.push('/auth/login');
            return;
        }

        setIsAddingToCart(true);
        try {
            await toastPromise(
                addToCart({
                    productId: id,
                    quantity: 1,
                }),
                {
                    loading: 'Adding to cart...',
                    success: 'Added to cart!',
                    error: (err: any) => err?.message || 'Failed to add to cart',
                }
            );
            await refetchCart();
            onAddToCart?.(id);
        } catch (err: any) {
            toastError(err?.message || 'Failed to add to cart');
        } finally {
            setIsAddingToCart(false);
        }
    };

    const toggleFavorite = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
            router.push('/auth/login');
            return;
        }

        setIsLoadingWishlist(true);
        try {
            if (isFavorite) {
                await removeFromWishlist(id);
                setIsFavorite(false);
            } else {
                await addToWishlist(id);
                setIsFavorite(true);
            }
        } catch (err: any) {
            toastError(err?.message || 'Failed to update wishlist');
        } finally {
            setIsLoadingWishlist(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4 p-4">
                {/* Product Image */}
                <Link
                    href={`/products/${id}`}
                    className="block relative w-full sm:w-48 h-48 sm:h-40 bg-gray-100 rounded-lg overflow-hidden shrink-0"
                >
                    {image ? (
                        <Image
                            src={image}
                            alt={name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 192px"
                            loader={imageLoader}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <span className="text-gray-400 text-sm">No Image</span>
                        </div>
                    )}
                </Link>

                {/* Product Info */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                        {/* Category & Rating */}
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-[#008ECC] uppercase tracking-wide">
                                {category}
                            </span>
                            {rating !== undefined && (
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
                                    <span className="text-yellow-400">★</span>
                                </div>
                            )}
                        </div>

                        {/* Product Name */}
                        <Link href={`/products/${id}`}>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-[#008ECC] transition-colors">
                                {name}
                            </h3>
                        </Link>

                        {/* Description */}
                        {description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {description}
                            </p>
                        )}

                        {/* Price */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl font-bold text-gray-900">₹{price.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-auto">
                        <button
                            onClick={handleAddToCart}
                            disabled={isAddingToCart || isInCart}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${isInCart
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : isAddingToCart
                                        ? 'bg-[#008ECC]/80 text-white cursor-wait'
                                        : 'bg-[#008ECC] text-white hover:bg-[#0077B5]'
                                }`}
                        >
                            {isAddingToCart ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Adding...</span>
                                </>
                            ) : isInCart ? (
                                <>
                                    <ShoppingCart size={18} />
                                    <span>In Cart</span>
                                </>
                            ) : (
                                <>
                                    <ShoppingCart size={18} />
                                    <span>Add to Cart</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={toggleFavorite}
                            disabled={isLoadingWishlist}
                            className={`p-2.5 rounded-lg border transition-colors ${isFavorite
                                    ? 'bg-red-50 border-red-200 text-red-600'
                                    : 'bg-white border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600'
                                } ${isLoadingWishlist ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                            {isLoadingWishlist ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
