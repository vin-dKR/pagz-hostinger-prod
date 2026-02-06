"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { imageLoader } from "@/lib/utils/image-loader";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getProducts, type Product } from "../../lib/api/products";
import { addToCart } from "@/lib/api/cart";
import { toastError, toastPromise } from "@/lib/utils/toast";

export default function BestSeller() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { refetch: refetchCart, isProductInCart } = useCart();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingToCartId, setAddingToCartId] = useState<string | null>(null);

    useEffect(() => {
        const fetchBestSellers = async () => {
            try {
                setLoading(true);
                const response = await getProducts({
                    // isBestSeller: true,
                    limit: 8,
                    page: 1,
                });

                if (response.success && response.data) {
                    setProducts(response.data.products);
                }
            } catch (error) {
                console.error("Failed to fetch best sellers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBestSellers();
    }, []);

    const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>, productId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const product = products.find(p => p.id === productId);
        if (!product) return;

        const isInCart = isProductInCart(product.name);

        // If already in cart, navigate to cart page
        if (isInCart) {
            router.push('/cart');
            return;
        }

        if (!isAuthenticated) {
            router.push('/auth/login');
            return;
        }

        setAddingToCartId(productId);
        try {
            const response = await toastPromise(
                addToCart({
                    productId: productId,
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
            setAddingToCartId(null);
        }
    };

    // Loading skeleton
    if (loading) {
        return (
            <section className="py-6 md:py-8 bg-white">
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-4 md:mb-5">
                        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="overflow-x-auto scrollbar-hide">
                        <div className="flex gap-3 sm:gap-4 md:gap-5 pb-4">
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i} className="shrink-0 w-48 sm:w-56 md:w-64 h-64 sm:h-72 md:h-80 bg-gray-200 rounded-xl md:rounded-2xl animate-pulse"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // No products message
    if (!loading && products.length === 0) {
        return null; // Don't show section if no products
    }

    return (
        <section className="py-6 md:py-8 bg-white">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-4 md:mb-5">
                    <h2 className="text-xl md:text-2xl font-semibold text-gray-900">Best Seller</h2>
                    <Link
                        href="/products?sort=bestseller"
                        className="flex items-center gap-2 text-[#008ECC] hover:text-blue-700 font-medium transition-colors text-sm sm:text-base"
                    >
                        Show More
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </Link>
                </div>

                {/* Horizontal Scrollable Product Grid */}
                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-4 sm:gap-6 pb-4" style={{ minWidth: "max-content" }}>
                        {products.map((product) => (
                            <div
                                key={product.id}
                                className="shrink-0 w-64 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative"
                            >
                                {/* Product Image */}
                                <Link href={`/products/${product.id}`} className="block relative aspect-square bg-gray-50 rounded-t-2xl overflow-hidden">
                                    {product.images && product.images.length > 0 ? (
                                        <Image
                                            src={product.images[0]?.url || ''}
                                            alt={product.images[0]?.alt || product.name || ''}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 50vw, 25vw"
                                            loader={imageLoader}
                                        />
                                    ) : (
                                        <Image
                                            src={'/images/pagz-logo.png'}
                                            alt={product.name || 'Product image'}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 50vw, 25vw"
                                            loader={imageLoader}
                                        />
                                    )}

                                    {/* Bestseller Badge */}
                                    <div className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm">
                                        BESTSELLER
                                    </div>
                                </Link>

                                {/* Product Info */}
                                <div className="p-4">
                                    <Link href={`/products/${product.id}`}>
                                        <p className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">
                                            {product.shortDescription || product.name}
                                        </p>
                                        <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-2">
                                            {product.category?.name || "Unknown category"}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            {product.sellingPrice && product.sellingPrice < product.basePrice ? (
                                                <>
                                                    <p className="text-base sm:text-lg font-semibold text-gray-900">
                                                        ₹{Number(product.sellingPrice).toFixed(2)}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-gray-400 line-through">
                                                        ₹{Number(product.basePrice).toFixed(2)}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-base sm:text-lg font-semibold text-gray-900">
                                                    ₹{Number(product.basePrice).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                </div>

                                {/* Add to Cart Button */}
                                <button
                                    onClick={(e) => handleAddToCart(e, product.id)}
                                    disabled={addingToCartId === product.id}
                                    className={`absolute bottom-4 right-4 w-10 h-10 ${isProductInCart(product.name)
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-[#008ECC] hover:bg-blue-700'
                                        } rounded-xl flex items-center justify-center text-white shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    aria-label={isProductInCart(product.name) ? "Go to cart" : "Add to cart"}
                                >
                                    {addingToCartId === product.id ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : isProductInCart(product.name) ? (
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
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
