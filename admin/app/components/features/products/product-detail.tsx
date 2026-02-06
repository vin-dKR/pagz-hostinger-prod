/**
 * Product Detail Component
 * Rich summary of a single product and all related data.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Alert } from '@/app/components/ui/alert';
import { PageLoading } from '@/app/components/ui/loading';
import { getProduct, type Product } from '@/lib/api/products.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';

export function ProductDetail({ productId, initialProduct }: { productId: string; initialProduct?: Product }) {
    const router = useRouter();
    const [product, setProduct] = useState<Product | null>(initialProduct || null);
    const [isLoading, setIsLoading] = useState(!initialProduct);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        if (!initialProduct) {
            void loadProduct();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, initialProduct]);

    const loadProduct = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getProduct(productId);
            setProduct(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load product');
            setProduct(null);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error || !product) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <Alert variant="error">{error || 'Product not found'}</Alert>
            </div>
        );
    }

    // Initialize selected image when product changes
    useEffect(() => {
        if (product) {
            const defaultImage =
                product.images.find((img) => img.isPrimary)?.url || product.images[0]?.url || null;
            setSelectedImage(defaultImage);
        }
    }, [product]);

    return (
        <div className="space-y-8 max-w-[1600px]">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => router.back()} className="flex-shrink-0">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight flex items-center gap-2 flex-wrap">
                            {product.name}
                            {product.isFeatured && <Badge>Featured</Badge>}
                            {product.isNewArrival && <Badge variant="outline">New</Badge>}
                            {product.isBestSeller && <Badge variant="outline">Best seller</Badge>}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-foreground-secondary)]">
                            <span className="font-mono">
                                slug: {product.slug || '(auto-generated)'}
                            </span>
                            <span>•</span>
                            <span>Category: {product.category?.name || 'Unassigned'}</span>
                            <span>•</span>
                            <span>SKU: {product.sku || '—'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={product.isActive ? 'success' : 'outline'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Link href={`/products/${product.id}/edit`}>
                        <Button>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit product
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Top visuals: Images + Quick stats */}
            <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr),minmax(260px,0.8fr)]">
                <Card>
                    <CardHeader>
                        <CardTitle>Images</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="aspect-square w-full max-w-[320px] mx-auto overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-background-secondary)] flex items-center justify-center">
                            {selectedImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={selectedImage}
                                    alt={product.name}
                                    className="h-full w-full object-contain p-2"
                                />
                            ) : (
                                <span className="text-sm text-[var(--color-foreground-tertiary)]">No primary image</span>
                            )}
                        </div>
                        {product.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center">
                                {product.images.map((img) => {
                                    const isSelected = selectedImage === img.url;
                                    return (
                                        <button
                                            key={img.id}
                                            type="button"
                                            onClick={() => setSelectedImage(img.url)}
                                            className={`h-16 w-16 rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)] cursor-pointer transition-all hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${isSelected ? 'ring-2 ring-[var(--color-primary)]' : ''
                                                }`}
                                            aria-label={img.alt || product.name}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={img.url}
                                                alt={img.alt || product.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Stats Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Rating</span>
                            <span className="font-medium text-[var(--color-foreground)]">{product.rating ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Reviews</span>
                            <span className="font-medium text-[var(--color-foreground)]">{product.totalReviews}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Total Sold</span>
                            <span className="font-medium text-[var(--color-foreground)]">{product.totalSold}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Stock</span>
                            <span className={`font-medium ${product.stock > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'}`}>
                                {product.stock}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="space-y-6">
                {/* Pricing & Inventory - Top priority info */}
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pricing</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-[var(--color-foreground-secondary)] mb-1">Base Price</p>
                                <p className="text-2xl font-semibold text-[var(--color-foreground)]">
                                    {formatCurrency(product.basePrice)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--color-foreground-secondary)] mb-1">Selling Price / MRP</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-semibold text-[var(--color-success)]">
                                        {formatCurrency(product.sellingPrice || product.basePrice)}
                                    </span>
                                    {product.mrp && (
                                        <span className="text-sm text-[var(--color-foreground-tertiary)] line-through">
                                            {formatCurrency(product.mrp)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {product.returnPolicy && (
                                <div className="pt-2 border-t border-[var(--color-border)]">
                                    <p className="text-sm font-medium text-[var(--color-foreground-secondary)] mb-1">Return Policy</p>
                                    <p className="text-sm text-[var(--color-foreground)] whitespace-pre-line">
                                        {product.returnPolicy}
                                    </p>
                                </div>
                            )}
                            {product.warranty && (
                                <div className="pt-2 border-t border-[var(--color-border)]">
                                    <p className="text-sm font-medium text-[var(--color-foreground-secondary)] mb-1">Warranty</p>
                                    <p className="text-sm text-[var(--color-foreground)] whitespace-pre-line">
                                        {product.warranty}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Inventory & Logistics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--color-foreground-secondary)]">Stock</span>
                                <span className={`text-sm font-semibold ${product.stock > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'}`}>
                                    {product.stock}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--color-foreground-secondary)]">Min order quantity</span>
                                <span className="text-sm font-medium text-[var(--color-foreground)]">{product.minOrderQuantity}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--color-foreground-secondary)]">Max order quantity</span>
                                <span className="text-sm font-medium text-[var(--color-foreground)]">
                                    {product.maxOrderQuantity !== null ? product.maxOrderQuantity : 'No limit'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--color-foreground-secondary)]">Weight</span>
                                <span className="text-sm font-medium text-[var(--color-foreground)]">{product.weight ?? '—'} kg</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-[var(--color-foreground-secondary)]">Dimensions</span>
                                <span className="text-sm font-medium text-[var(--color-foreground)]">{product.dimensions || '—'}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Product Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Product Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {product.shortDescription && (
                            <div>
                                <p className="text-sm font-medium text-[var(--color-foreground-secondary)] mb-2">Short Description</p>
                                <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{product.shortDescription}</p>
                            </div>
                        )}
                        {product.description && (
                            <div>
                                <p className="text-sm font-medium text-[var(--color-foreground-secondary)] mb-2">Description</p>
                                <p className="text-sm text-[var(--color-foreground)] whitespace-pre-line leading-relaxed">
                                    {product.description}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Specifications */}
                <Card>
                    <CardHeader>
                        <CardTitle>Specifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {product.specifications.length === 0 ? (
                            <p className="text-sm text-[var(--color-foreground-tertiary)]">No specifications configured.</p>
                        ) : (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {product.specifications
                                    .slice()
                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                    .map((spec) => (
                                        <div key={spec.id} className="border-b border-[var(--color-border)] pb-3 last:border-0">
                                            <dt className="text-sm text-[var(--color-foreground-secondary)] mb-1">{spec.key}</dt>
                                            <dd className="text-sm font-medium text-[var(--color-foreground)]">
                                                {spec.value}
                                            </dd>
                                        </div>
                                    ))}
                            </dl>
                        )}
                    </CardContent>
                </Card>

                {/* Attributes & Tags */}
                {(product.attributes.length > 0 || product.tags.length > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Attributes & Tags</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {product.attributes.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-[var(--color-foreground-secondary)] mb-3">
                                        Attributes
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {product.attributes.map((attr) => (
                                            <Badge
                                                key={attr.id}
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {attr.attributeType}: {attr.attributeValue}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {product.tags.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-[var(--color-foreground-secondary)] mb-3">Tags</p>
                                    <div className="flex flex-wrap gap-2">
                                        {product.tags.map((tag) => (
                                            <Badge
                                                key={tag.id}
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {tag.tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Variants */}
                <Card>
                    <CardHeader>
                        <CardTitle>Variants ({product.variants.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {product.variants.length === 0 ? (
                            <p className="text-sm text-[var(--color-foreground-tertiary)]">No variants configured.</p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {product.variants.map((variant) => {
                                    const finalPrice =
                                        Number(product.basePrice) +
                                        Number(variant.priceModifier || 0);
                                    return (
                                        <div
                                            key={variant.id}
                                            className="flex items-center justify-between border border-[var(--color-border)] rounded-[var(--radius)] px-4 py-3 hover:bg-[var(--color-accent)] transition-colors"
                                        >
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-[var(--color-foreground)]">
                                                    {variant.name}
                                                </p>
                                                <p className="text-xs text-[var(--color-foreground-tertiary)]">
                                                    SKU: {variant.sku || '—'} • Stock: {variant.stock}
                                                </p>
                                            </div>
                                            <div className="text-right space-y-1">
                                                <p className="text-sm font-semibold text-[var(--color-foreground)]">
                                                    {formatCurrency(finalPrice)}
                                                </p>
                                                <Badge variant={variant.available ? 'success' : 'outline'} className="text-xs">
                                                    {variant.available ? 'Available' : 'Hidden'}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Metadata */}
                <Card>
                    <CardHeader>
                        <CardTitle>Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Created</span>
                            <span className="text-[var(--color-foreground)]">{formatDate(product.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-foreground-secondary)]">Last Updated</span>
                            <span className="text-[var(--color-foreground)]">{formatDate(product.updatedAt)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


