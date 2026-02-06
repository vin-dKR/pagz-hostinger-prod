import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getProduct, getProducts, Product } from '@/lib/api/products';
import { addToWishlist, removeFromWishlist, checkWishlist } from '@/lib/api/wishlist';
import { addToCart, AddToCartData } from '@/lib/api/cart';
import { useAuth } from '@/contexts/AuthContext';
import { redirectToLoginWithReturn } from '@/lib/utils/auth-redirect';

export interface UseProductOptions {
    productId: string;
}

export const useProduct = ({ productId }: UseProductOptions) => {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [cartLoading, setCartLoading] = useState(false);
    const [buyNowLoading, setBuyNowLoading] = useState(false);

    // Computed values
    const currentPrice = useMemo(() => {
        if (!product) return 0;
        return Number(product.sellingPrice || product.basePrice);
    }, [product]);

    const originalPrice = useMemo(() => {
        if (!product?.mrp) return undefined;
        return Number(product.mrp);
    }, [product]);

    const discount = useMemo(() => {
        if (!originalPrice) return undefined;
        return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }, [originalPrice, currentPrice]);

    // Fetch product data
    useEffect(() => {
        const fetchProductData = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await getProduct(productId);

                if (response.success && response.data) {
                    const productData = response.data;
                    setProduct(productData);

                    // Fetch related products (same category)
                    if (productData.categoryId) {
                        const relatedResponse = await getProducts({
                            category: productData.categoryId,
                            limit: 4,
                        });

                        if (relatedResponse.success && relatedResponse.data) {
                            const related = relatedResponse.data.products.filter(
                                (p) => p.id !== productData.id
                            );
                            setRelatedProducts(related);
                        }
                    }
                } else {
                    setError('Product not found');
                }
            } catch (err: any) {
                console.error('Error fetching product:', err);
                setError(err.message || 'Failed to load product');
            } finally {
                setLoading(false);
            }
        };

        fetchProductData();
    }, [productId]);

    // Check wishlist status
    useEffect(() => {
        const checkWishlistStatus = async () => {
            if (!isAuthenticated || !productId) return;

            try {
                const response = await checkWishlist(productId);
                if (response.success && response.data) {
                    setIsWishlisted(response.data.isInWishlist);
                }
            } catch (err) {
                // Silently fail - wishlist check is not critical
                console.warn('Failed to check wishlist status:', err);
            }
        };

        checkWishlistStatus();
    }, [isAuthenticated, productId]);

    // Toggle wishlist
    const toggleWishlist = useCallback(async (): Promise<boolean> => {
        if (!isAuthenticated) {
            redirectToLoginWithReturn();
            return false;
        }

        if (!productId) return false;

        setWishlistLoading(true);
        try {
            if (isWishlisted) {
                const response = await removeFromWishlist(productId);
                if (response.success) {
                    setIsWishlisted(false);
                    return true;
                }
            } else {
                const response = await addToWishlist(productId);
                if (response.success) {
                    setIsWishlisted(true);
                    return true;
                }
            }
            return false;
        } catch (err) {
            console.error('Error toggling wishlist:', err);
            return false;
        } finally {
            setWishlistLoading(false);
        }
    }, [isAuthenticated, productId, isWishlisted, router]);

    // Add to cart
    const handleAddToCart = useCallback(async (data: Omit<AddToCartData, 'productId'>): Promise<boolean> => {
        if (!isAuthenticated) {
            redirectToLoginWithReturn();
            return false;
        }

        if (!productId) return false;

        setCartLoading(true);
        try {
            const response = await addToCart({
                productId,
                ...data,
            });

            if (response.success) {
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error adding to cart:', err);
            return false;
        } finally {
            setCartLoading(false);
        }
    }, [isAuthenticated, productId, router]);

    // Buy now - stores product data in sessionStorage and redirects to checkout (bypasses cart)
    const handleBuyNow = useCallback(async (data: Omit<AddToCartData, 'productId'>): Promise<boolean> => {
        if (!isAuthenticated) {
            redirectToLoginWithReturn();
            return false;
        }

        if (!productId || !product) return false;

        setBuyNowLoading(true);
        try {
            // Store product data in sessionStorage for direct checkout (bypass cart)
            const buyNowData = {
                productId,
                quantity: data.quantity || 1,
                variantId: data.variantId,
                customDesignUrl: data.customDesignUrl,
                product: product,
                price: currentPrice * (data.quantity || 1),
            };

            if (typeof window !== 'undefined') {
                sessionStorage.setItem('buyNow', JSON.stringify(buyNowData));
            }

            // Redirect to checkout immediately
            router.push('/checkout');
            return true;
        } catch (err) {
            console.error('Error in buy now:', err);
            return false;
        } finally {
            setBuyNowLoading(false);
        }
    }, [isAuthenticated, productId, product, currentPrice, router]);

    // Generate share link
    const shareLink = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/products/${productId}`;
    }, [productId]);

    // Copy share link to clipboard
    const copyShareLink = useCallback(async (): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(shareLink);
            return true;
        } catch (err) {
            console.error('Failed to copy share link:', err);
            return false;
        }
    }, [shareLink]);

    // Share via Web Share API
    const shareProduct = useCallback(async (): Promise<boolean> => {
        if (!product) return false;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.name,
                    text: product.shortDescription || product.description,
                    url: shareLink,
                });
                return true;
            } catch (err) {
                // User cancelled or error
                return false;
            }
        } else {
            // Fallback to clipboard
            return await copyShareLink();
        }
    }, [product, shareLink, copyShareLink]);



    const breadcrumbs = useMemo(() => {
        if (!product) return [];
        return [
            { label: 'Home', href: '/' },
            { label: 'Shop', href: '/products' },
            ...(product.category
                ? [{ label: product.category.name, href: `/products?category=${product.category.slug}` }]
                : []),
            { label: product.name, href: `/products/${product.id}` },
        ];
    }, [product]);

    const productImages = useMemo(() => {
        if (!product?.images || product.images.length === 0) return ['/products/placeholder.jpg'];
        // Clean URLs - remove any Next.js Image Optimization query params that might have been added
        return product.images.map((img) => {
            const url = img.url || '';
            // Remove query parameters if they look like Next.js optimization params (w=, q=)
            if (url.includes('&w=') || url.includes('?w=') || url.includes('&q=') || url.includes('?q=')) {
                return url.split('&')[0]?.split('?')[0];
            }
            return url;
        });
    }, [product?.images]);

    const sizes = useMemo(() => {
        if (!product?.variants) return [];
        return product.variants.map((v) => v.name);
    }, [product]);

    return {
        product,
        relatedProducts,
        loading,
        error,
        isWishlisted,
        wishlistLoading,
        cartLoading,
        buyNowLoading,
        toggleWishlist,
        handleAddToCart,
        handleBuyNow,
        shareLink,
        copyShareLink,
        shareProduct,
        currentPrice,
        originalPrice,
        discount,
        breadcrumbs,
        productImages,
        sizes,
    };
};

