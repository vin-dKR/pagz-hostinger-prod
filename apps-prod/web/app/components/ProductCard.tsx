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

interface ProductCardProps {
    id: string;
    name: string;
    category: string;
    price: number;
    image?: string;
    onAddToCart?: (id: string) => void;
}

export default function ProductCard({
    id,
    category,
    name,
    price,
    image,
    onAddToCart,
}: ProductCardProps) {
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

        // If already in cart, navigate to cart page
        if (isInCart) {
            router.push('/cart');
            return;
        }

        if (!isAuthenticated) {
            router.push('/auth/login');
            return;
        }

        setIsAddingToCart(true);
        try {
            const response = await toastPromise(
                addToCart({
                    productId: id,
                    quantity: 1,
                }),
                {
                    loading: 'Adding to cart...',
                    success: 'Product added to cart successfully!',
                    error: 'Failed to add to cart. Please try again.',
                }
            );


            if (response.success) {
                await refetchCart();
            } else {
                toastError(response.error || 'Failed to add to cart');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add to cart. Please try again.';
            toastError(errorMessage);
        } finally {
            setIsAddingToCart(false);
        }
    };

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
            router.push('/auth/login');
            return;
        }

        setIsLoadingWishlist(true);
        try {
            if (isFavorite) {
                const response = await toastPromise(
                    removeFromWishlist(id),
                    {
                        loading: 'Removing from wishlist...',
                        success: 'Removed from wishlist',
                        error: 'Failed to remove from wishlist',
                    }
                );
                if (response.success) {
                    setIsFavorite(false);
                }
            } else {
                const response = await toastPromise(
                    addToWishlist(id),
                    {
                        loading: 'Adding to wishlist...',
                        success: 'Added to wishlist',
                        error: 'Failed to add to wishlist',
                    }
                );
                if (response.success) {
                    setIsFavorite(true);
                }
            }
        } catch (err) {
            console.error('Error toggling wishlist:', err);
            toastError('Failed to update wishlist. Please try again.');
        } finally {
            setIsLoadingWishlist(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden relative group">
            {/* Product Image */}
            <Link href={`/products/${id}`} className="block relative aspect-square bg-gray-100">
                {image ? (
                    <Image
                        src={image}
                        alt={name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        loader={imageLoader}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <span className="text-gray-400 text-sm">Product Image</span>
                    </div>
                )}

                {/* Favorite Button - Always visible if wishlisted, otherwise on hover */}
                <button
                    onClick={toggleFavorite}
                    disabled={isLoadingWishlist}
                    className={`absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-10 disabled:opacity-50 ${isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    {isLoadingWishlist ? (
                        <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={isFavorite ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={isFavorite ? "text-red-500" : "text-gray-600"}
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    )}
                </button>
            </Link>

            {/* Product Info */}
            <div className="p-4">
                <Link href={`/products/${id}`}>
                    <p className="text-sm text-gray-600 mb-1 line-clamp-1 font-hkgb">{name}</p>
                    <p className="text-sm text-gray-600 mb-1 line-clamp-2">{category}</p>
                    <p className="text-lg font-bold text-gray-900">₹{price.toFixed(2)}</p>
                </Link>
            </div>

            {/* Add to Cart Button */}
            <button
                onClick={handleAddToCart}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                disabled={isAddingToCart}
                className={`absolute bottom-4 right-4 w-10 h-10 ${isInCart
                    ? 'bg-green-500 hover:bg-green-600 active:bg-green-700'
                    : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700'
                    } rounded-lg flex items-center justify-center text-white shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                aria-label={isInCart ? "Go to cart" : "Add to cart"}
                type="button"
            >
                {isAddingToCart ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : isInCart ? (
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                ) : (
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                )}
            </button>
        </div>
    );
}
