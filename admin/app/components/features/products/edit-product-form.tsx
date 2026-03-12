'use client';

/**
 * Edit Product Form
 * Single-page form for editing an existing product, covering all Product fields
 * and related models (images, specifications, attributes, tags, variants).
 */

import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import {
    getProduct,
    updateProduct,
    uploadProductImageApi,
    getProductAddons,
    addProductAddon,
    removeProductAddon,
    type CreateProductData,
    type Product,
    type ProductImage,
    type ProductAddon,
} from '@/lib/api/products.service';
import { getCategories, type Category, type PaginatedCategories, getCategoryPricingRulesApi, updateCategoryPricingRuleApi, type CategoryPricingRule } from '@/lib/api/categories.service';
import { X, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useConfirm } from '@/lib/hooks/use-confirm';
import Link from 'next/link';
import { toastPromise } from '@/lib/utils/toast';

interface EditProductFormProps {
    productId: string;
}

export function EditProductForm({ productId }: EditProductFormProps) {
    const router = useRouter();
    const { confirm, ConfirmDialog } = useConfirm();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreateProductData | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [fileMetadata, setFileMetadata] = useState<Map<number, { alt: string; isPrimary: boolean }>>(new Map());
    const [uploadingImages, setUploadingImages] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Addon management state
    const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
    const [availableAddonRules, setAvailableAddonRules] = useState<any[]>([]);
    const [loadingAddons, setLoadingAddons] = useState(false);
    const [categorySpecs, setCategorySpecs] = useState<any[]>([]);
    
    // Pricing rule state (if product is generated from pricing rule)
    const [pricingRule, setPricingRule] = useState<CategoryPricingRule | null>(null);
    const [pricingRuleForm, setPricingRuleForm] = useState({
        basePrice: '',
        priceModifier: '',
        quantityMultiplier: false,
        minQuantity: '',
        maxQuantity: '',
        isActive: true,
        priority: '0',
    });

    // Load product + categories
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const [product, categoryResult] = await Promise.all([
                    getProduct(productId),
                    getCategories({ page: 1, limit: 200 }),
                ]);

                setCategories(categoryResult.items);
                setFormData(mapProductToFormData(product));

                // Load product addons and pricing rule
                try {
                    const addonsData = await getProductAddons(productId);
                    setProductAddons(addonsData.addons);
                    setCategorySpecs(addonsData.category.specifications || []);

                    // Load available addon rules for the category
                    const rules = await getCategoryPricingRulesApi(product.categoryId);
                    const addonRules = rules.filter(r => r.ruleType === 'ADDON' && r.isActive);
                    setAvailableAddonRules(addonRules);
                    
                    // Load pricing rule if product is generated from one
                    if (product.generatedFromPricingRule) {
                        const linkedRule = rules.find(r => r.productId === productId);
                        if (linkedRule) {
                            setPricingRule(linkedRule);
                            setPricingRuleForm({
                                basePrice: linkedRule.basePrice != null ? String(linkedRule.basePrice) : '',
                                priceModifier: linkedRule.priceModifier != null ? String(linkedRule.priceModifier) : '',
                                quantityMultiplier: linkedRule.quantityMultiplier,
                                minQuantity: linkedRule.minQuantity != null ? String(linkedRule.minQuantity) : '',
                                maxQuantity: linkedRule.maxQuantity != null ? String(linkedRule.maxQuantity) : '',
                                isActive: linkedRule.isActive,
                                priority: String(linkedRule.priority ?? 0),
                            });
                        }
                    }
                } catch (addonErr) {
                    console.warn('Failed to load product addons', addonErr);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load product');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [productId]);

    // Category search (optional refinement)
    useEffect(() => {
        const loadCategories = async () => {
            try {
                setCategoriesLoading(true);
                const data: PaginatedCategories = await getCategories({
                    page: 1,
                    limit: 200,
                    search: categorySearch || undefined,
                });
                setCategories(data.items);
            } catch {
                // keep existing categories
            } finally {
                setCategoriesLoading(false);
            }
        };

        if (categorySearch.trim()) {
            void loadCategories();
        }
    }, [categorySearch]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData) return;
        setError(null);
        setIsSubmitting(true);

        try {
            // Require at least one image before saving
            if (!formData.images || formData.images.length === 0) {
                setError('Please add at least one product image before saving.');
                return;
            }

            const payload: CreateProductData = {
                ...formData,
                basePrice: Number(formData.basePrice || 0),
                sellingPrice:
                    formData.sellingPrice !== undefined && formData.sellingPrice !== null
                        ? Number(formData.sellingPrice)
                        : undefined,
                mrp:
                    formData.mrp !== undefined && formData.mrp !== null
                        ? Number(formData.mrp)
                        : undefined,
                stock: Number(formData.stock || 0),
                minOrderQuantity: Number(formData.minOrderQuantity || 1),
                maxOrderQuantity:
                    formData.maxOrderQuantity !== undefined && formData.maxOrderQuantity !== null
                        ? Number(formData.maxOrderQuantity)
                        : null,
                weight:
                    formData.weight !== undefined && formData.weight !== null
                        ? Number(formData.weight)
                        : undefined,
            };

            await updateProduct({ id: productId, ...payload });
            router.push(`/products/${productId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save product');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !formData) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-sm text-gray-500">
                    Loading product…
                </CardContent>
            </Card>
        );
    }

    const images = formData.images || [];
    const specifications = formData.specifications || [];
    const attributes = formData.attributes || [];
    const tags = formData.tags || [];
    const variants = formData.variants || [];

    return (
        <>
            {ConfirmDialog}
            <div className="space-y-8 max-w-[1600px]">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">
                            Edit Product
                        </h1>
                        <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                            Update product details and settings
                        </p>
                    </div>
                </div>

                    {error && (
                        <Alert variant="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Images */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Images</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* File Upload Section */}
                                <div className="space-y-4 border rounded-lg p-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="image-files">Upload Images</Label>
                                        <Input
                                            id="image-files"
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                            multiple
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);

                                                // Validate file types
                                                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
                                                const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));

                                                if (invalidFiles.length > 0) {
                                                    setError('Invalid file type. Please upload JPG, PNG, WebP, or GIF images.');
                                                    return;
                                                }

                                                // Validate file sizes (10MB each)
                                                const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
                                                if (oversizedFiles.length > 0) {
                                                    setError('File size must be less than 10MB per image.');
                                                    return;
                                                }

                                                setSelectedFiles(prev => [...prev, ...files]);
                                                setError(null);

                                                // Initialize metadata for new files
                                                const newMetadata = new Map(fileMetadata);
                                                files.forEach((_, index) => {
                                                    const globalIndex = selectedFiles.length + index;
                                                    newMetadata.set(globalIndex, {
                                                        alt: '',
                                                        isPrimary: images.length === 0 && globalIndex === 0,
                                                    });
                                                });
                                                setFileMetadata(newMetadata);
                                            }}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Supported formats: JPG, PNG, WebP, GIF. Max size: 10MB per image
                                        </p>
                                    </div>

                                    {/* Selected Files with Metadata */}
                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-3">
                                            {selectedFiles.map((file, index) => {
                                                const metadata = fileMetadata.get(index) || { alt: '', isPrimary: false };
                                                const isFirstFile = index === 0 && images.length === 0;

                                                return (
                                                    <div key={index} className="rounded-md border p-3 shadow-sm">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <p className="text-sm font-medium text-gray-800">
                                                                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                            </p>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const newFiles = selectedFiles.filter((_, i) => i !== index);
                                                                    setSelectedFiles(newFiles);

                                                                    // Update metadata map indices
                                                                    const newMetadata = new Map<number, { alt: string; isPrimary: boolean }>();
                                                                    newFiles.forEach((_, i) => {
                                                                        const oldIndex = i < index ? i : i + 1;
                                                                        const oldMeta = fileMetadata.get(oldIndex) || { alt: '', isPrimary: false };
                                                                        newMetadata.set(i, oldMeta);
                                                                    });
                                                                    setFileMetadata(newMetadata);
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div>
                                                                <Label htmlFor={`alt-text-${index}`}>Alt Text (optional)</Label>
                                                                <Input
                                                                    id={`alt-text-${index}`}
                                                                    placeholder="Description for this image"
                                                                    value={metadata.alt}
                                                                    onChange={(e) => {
                                                                        const newMetadata = new Map(fileMetadata);
                                                                        const current = newMetadata.get(index) || { alt: '', isPrimary: false };
                                                                        newMetadata.set(index, { ...current, alt: e.target.value });
                                                                        setFileMetadata(newMetadata);
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    id={`is-primary-${index}`}
                                                                    type="checkbox"
                                                                    checked={metadata.isPrimary || isFirstFile}
                                                                    onChange={(e) => {
                                                                        const newMetadata = new Map(fileMetadata);
                                                                        const current = newMetadata.get(index) || { alt: '', isPrimary: false };
                                                                        newMetadata.set(index, { ...current, isPrimary: e.target.checked });

                                                                        // If setting as primary, unset others
                                                                        if (e.target.checked) {
                                                                            newMetadata.forEach((meta, idx) => {
                                                                                if (idx !== index) {
                                                                                    newMetadata.set(idx, { ...meta, isPrimary: false });
                                                                                }
                                                                            });
                                                                        }
                                                                        setFileMetadata(newMetadata);
                                                                    }}
                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <Label htmlFor={`is-primary-${index}`} className="cursor-pointer">
                                                                    Set as primary image
                                                                </Label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {selectedFiles.length > 0 && (
                                        <Button
                                            type="button"
                                            onClick={async () => {
                                                if (selectedFiles.length === 0) return;

                                                setUploadingImages(true);
                                                try {
                                                    const uploadedImages: ProductImage[] = [];
                                                    for (let i = 0; i < selectedFiles.length; i++) {
                                                        const file = selectedFiles[i];
                                                        if (!file) continue;

                                                        const metadata = fileMetadata.get(i) || { alt: '', isPrimary: false };
                                                        const newImage = await uploadProductImageApi(productId, file, {
                                                            alt: metadata.alt.trim() || undefined,
                                                            isPrimary: metadata.isPrimary || (i === 0 && images.length === 0),
                                                        });
                                                        uploadedImages.push(newImage);
                                                    }

                                                    // Add uploaded images to form data
                                                    setFormData((prev) => {
                                                        if (!prev) return prev;
                                                        const existingImages = prev.images || [];
                                                        return {
                                                            ...prev,
                                                            images: [
                                                                ...existingImages,
                                                                ...uploadedImages.map(img => ({
                                                                    url: img.url,
                                                                    alt: img.alt || '',
                                                                    isPrimary: img.isPrimary,
                                                                    displayOrder: existingImages.length + uploadedImages.indexOf(img),
                                                                })),
                                                            ],
                                                        };
                                                    });

                                                    // Clear selected files
                                                    setSelectedFiles([]);
                                                    setFileMetadata(new Map());
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.value = '';
                                                    }
                                                } catch (err) {
                                                    setError(err instanceof Error ? err.message : 'Failed to upload images');
                                                } finally {
                                                    setUploadingImages(false);
                                                }
                                            }}
                                            isLoading={uploadingImages}
                                            disabled={selectedFiles.length === 0 || uploadingImages}
                                        >
                                            {uploadingImages ? 'Uploading...' : `Upload ${selectedFiles.length} Image${selectedFiles.length !== 1 ? 's' : ''}`}
                                        </Button>
                                    )}
                                </div>

                                {/* Existing Images */}
                                {images.length > 0 && (
                                    <div className="space-y-3">
                                        <Label>Product Images ({images.length})</Label>
                                        {images.map((img, index) => (
                                            <div
                                                key={index}
                                                className="grid gap-3 rounded-md border p-3 md:grid-cols-[auto,1fr,1fr,auto]"
                                            >
                                                {img.url && (
                                                    <div className="relative w-20 h-20 rounded overflow-hidden border">
                                                        <Image
                                                            src={img.url}
                                                            alt={img.alt || 'Product image'}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized={img.url?.includes('amazonaws.com') || img.url?.includes('s3.')}
                                                        />
                                                    </div>
                                                )}

                                                <div className="space-y-1">
                                                    <Label>Alt text</Label>
                                                    <Input
                                                        value={img.alt || ''}
                                                        onChange={(e) => {
                                                            const next = [...images];
                                                            next[index] = { ...next[index], alt: e.target.value };
                                                            setFormData((prev) =>
                                                                prev ? { ...prev, images: next } : prev,
                                                            );
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-col justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!img.isPrimary}
                                                            onChange={() => {
                                                                const next = images.map((image, i) => ({
                                                                    ...image,
                                                                    isPrimary: i === index,
                                                                }));
                                                                setFormData((prev) =>
                                                                    prev ? { ...prev, images: next } : prev,
                                                                );
                                                            }}
                                                        />
                                                        <span className="text-xs">Primary</span>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const next = images.filter((_, i) => i !== index);
                                                            setFormData((prev) =>
                                                                prev ? { ...prev, images: next } : prev,
                                                            );
                                                        }}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Product Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Product Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, name: e.target.value } : prev,
                                        )
                                    }
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                    id="slug"
                                    value={formData.slug || ''}
                                    placeholder="auto-generated from name if left empty"
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, slug: e.target.value } : prev,
                                        )
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="shortDescription">Short Description</Label>
                            <Input
                                id="shortDescription"
                                value={formData.shortDescription || ''}
                                onChange={(e) =>
                                    setFormData((prev) =>
                                        prev
                                            ? { ...prev, shortDescription: e.target.value }
                                            : prev,
                                    )
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <textarea
                                id="description"
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={formData.description || ''}
                                onChange={(e) =>
                                    setFormData((prev) =>
                                        prev ? { ...prev, description: e.target.value } : prev,
                                    )
                                }
                            />
                        </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Classification & Pricing */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pricing</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="basePrice">Base Price (₹) *</Label>
                                <Input
                                    id="basePrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.basePrice}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    basePrice: Number(e.target.value || 0),
                                                }
                                                : prev,
                                        )
                                    }
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellingPrice">Selling Price (₹)</Label>
                                <Input
                                    id="sellingPrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.sellingPrice ?? ''}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    sellingPrice:
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value),
                                                }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mrp">MRP (₹)</Label>
                                <Input
                                    id="mrp"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.mrp ?? ''}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    mrp:
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value),
                                                }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="returnPolicy">Return Policy</Label>
                            <textarea
                                id="returnPolicy"
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={formData.returnPolicy || ''}
                                onChange={(e) =>
                                    setFormData((prev) =>
                                        prev ? { ...prev, returnPolicy: e.target.value } : prev,
                                    )
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="warranty">Warranty</Label>
                            <textarea
                                id="warranty"
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={formData.warranty || ''}
                                onChange={(e) =>
                                    setFormData((prev) =>
                                        prev ? { ...prev, warranty: e.target.value } : prev,
                                    )
                                }
                            />
                        </div>
                        </div>

                        {/* Existing Images */}
                        {images.length > 0 && (
                            <div className="space-y-3">
                                <Label>Product Images ({images.length})</Label>
                                {images.map((img, index) => (
                                    <div
                                        key={index}
                                        className="grid gap-3 rounded-md border p-3 md:grid-cols-[auto,1fr,1fr,auto]"
                                    >
                                        {img.url && (
                                            <div className="relative w-20 h-20 rounded overflow-hidden border">
                                                <Image
                                                    src={img.url}
                                                    alt={img.alt || 'Product image'}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized={img.url?.includes('amazonaws.com') || img.url?.includes('s3.')}
                                                />
                                            </div>
                                        )}
                                       
                                        <div className="space-y-1">
                                            <Label>Alt text</Label>
                                            <Input
                                                value={img.alt || ''}
                                                onChange={(e) => {
                                                    const next = [...images];
                                                    next[index] = { ...next[index], alt: e.target.value };
                                                    setFormData((prev) =>
                                                        prev ? { ...prev, images: next } : prev,
                                                    );
                                                }}
                                            />
                                        </div>
                                        <div className="flex flex-col justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!img.isPrimary}
                                                    onChange={() => {
                                                        const next = images.map((image, i) => ({
                                                            ...image,
                                                            isPrimary: i === index,
                                                        }));
                                                        setFormData((prev) =>
                                                            prev ? { ...prev, images: next } : prev,
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs">Primary</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const next = images.filter((_, i) => i !== index);
                                                    setFormData((prev) =>
                                                        prev ? { ...prev, images: next } : prev,
                                                    );
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/*
                        FUTURE FEATURE: Add Image URL
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setFormData((prev) =>
                                    prev
                                        ? {
                                            ...prev,
                                            images: [
                                                ...(prev.images || []),
                                                {
                                                    url: '',
                                                    alt: '',
                                                    isPrimary: images.length === 0,
                                                    displayOrder: prev.images
                                                        ? prev.images.length
                                                        : 0,
                                                },
                                            ],
                                        }
                                        : prev,
                                )
                            }
                        >
                            Add Image URL
                        </Button> */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium">Attributes (filterable facets)</p>
                            {attributes.map((attr, index) => (
                                <div
                                    key={index}
                                    className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr,1fr,auto]"
                                >
                                    <div className="space-y-1">
                                        <Label>Attribute Type</Label>
                                        <Input
                                            placeholder="e.g. color, size, finish"
                                            value={attr.type}
                                            onChange={(e) => {
                                                const next = [...attributes];
                                                next[index] = {
                                                    ...next[index],
                                                    type: e.target.value ?? '',
                                                };
                                                setFormData((prev) =>
                                                    prev
                                                        ? { ...prev, attributes: next }
                                                        : prev,
                                                );
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Attribute Value</Label>
                                        <Input
                                            placeholder="e.g. red, L, matte"
                                            value={attr.value}
                                            onChange={(e) => {
                                                const next = [...attributes];
                                                next[index] = {
                                                    ...next[index],
                                                    value: e.target.value ?? '',
                                                };
                                                setFormData((prev) =>
                                                    prev
                                                        ? { ...prev, attributes: next }
                                                        : prev,
                                                );
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="flex flex-col justify-between gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const next = attributes.filter(
                                                    (_, i) => i !== index,
                                                );
                                                setFormData((prev) =>
                                                    prev
                                                        ? { ...prev, attributes: next }
                                                        : prev,
                                                );
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setFormData((prev) =>
                                        prev
                                            ? {
                                                ...prev,
                                                attributes: [
                                                    ...(prev.attributes || []),
                                                    { type: '', value: '' },
                                                ],
                                            }
                                            : prev,
                                    )
                                }
                            >
                                Add Attribute
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-medium">Tags</p>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag, index) => (
                                    <span
                                        key={`${tag}-${index}`}
                                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            className="text-gray-500 hover:text-gray-800"
                                            onClick={() => {
                                                const next = tags.filter((_, i) => i !== index);
                                                setFormData((prev) =>
                                                    prev ? { ...prev, tags: next } : prev,
                                                );
                                            }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <Input
                                placeholder="Type a tag and press Enter"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const value = (e.target as HTMLInputElement).value.trim();
                                        if (!value) return;
                                        if (!tags.includes(value)) {
                                            setFormData((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        tags: [...(prev.tags || []), value],
                                                    }
                                                    : prev,
                                            );
                                        }
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }}
                            />
                        </div>

                                {/* Current Addons */}
                                {productAddons.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Current Addons</Label>
                                        <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4 space-y-2">
                                            {productAddons.map((pa) => {
                                                const addon = pa.addonRule;
                                                const specValues = (addon.specificationValues || {}) as Record<string, any>;
                                                const specText = Object.entries(specValues)
                                                    .map(([key, val]) => {
                                                        const spec = categorySpecs.find(s => s.slug === key);
                                                        if (spec) {
                                                            const option = spec.options.find((o: { value: string; label: string }) => o.value === val);
                                                            return option ? option.label : val;
                                                        }
                                                        return val;
                                                    })
                                                    .join(', ');
                                                const rangeText = addon.minQuantity != null || addon.maxQuantity != null
                                                    ? ` (${addon.minQuantity ?? 0}-${addon.maxQuantity ?? '∞'} pages)`
                                                    : '';
                                                const priceText = addon.priceModifier != null
                                                    ? `₹${Number(addon.priceModifier).toFixed(2)}`
                                                    : addon.basePrice != null
                                                        ? `₹${Number(addon.basePrice).toFixed(2)}`
                                                        : 'Free';
                                return (
                                                    <div key={pa.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                                        <div className="flex-1">
                                                            <div className="font-medium text-gray-900">
                                                                {priceText}
                                                                {rangeText}
                                        </div>
                                                            {specText && (
                                                                <div className="text-xs text-gray-500 mt-0.5">
                                                                    {specText}
                                        </div>
                                                            )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                            onClick={async () => {
                                                                try {
                                                                    setLoadingAddons(true);
                                                                    await confirm({
                                                                        title: 'Remove Addon',
                                                                        description: 'Remove this addon from the product?',
                                                                        variant: 'destructive',
                                                                        onConfirm: async () => {
                                                                            await removeProductAddon(productId, pa.id);
                                                                            setProductAddons(prev => prev.filter(p => p.id !== pa.id));
                                                                        },
                                                                    });
                                                                } catch (err) {
                                                                    if (err instanceof Error && err.message !== 'Cancelled') {
                                                                        setError(err.message);
                                                                    }
                                                                } finally {
                                                                    setLoadingAddons(false);
                                                                }
                                                            }}
                                                            disabled={loadingAddons}
                                            >
                                                Remove
                                            </Button>
                                    </div>
                                );
                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Add New Addon */}
                                {availableAddonRules.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Available Addons to Add</Label>
                                        <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4 space-y-2 max-h-60 overflow-y-auto">
                                            {availableAddonRules
                                                .filter(rule => !productAddons.some(pa => pa.addonRuleId === rule.id))
                                                .map((addon) => {
                                                    const specValues = (addon.specificationValues || {}) as Record<string, any>;
                                                    const specText = Object.entries(specValues)
                                                        .map(([key, val]) => {
                                                            const spec = categorySpecs.find(s => s.slug === key);
                                                            if (spec) {
                                                                const option = spec.options.find((o: { value: string; label: string }) => o.value === val);
                                                                return option ? option.label : val;
                                                            }
                                                            return val;
                                                        })
                                                        .join(', ');
                                                    const rangeText = addon.minQuantity != null || addon.maxQuantity != null
                                                        ? ` (${addon.minQuantity ?? 0}-${addon.maxQuantity ?? '∞'} pages)`
                                                        : '';
                                                    const priceText = addon.priceModifier != null
                                                        ? `₹${Number(addon.priceModifier).toFixed(2)}`
                                                        : addon.basePrice != null
                                                            ? `₹${Number(addon.basePrice).toFixed(2)}`
                                                            : 'Free';
                                                    return (
                                                        <div key={addon.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-900">
                                                                    {priceText}
                                                                    {rangeText}
                                                                </div>
                                                                {specText && (
                                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                                        {specText}
                                                                    </div>
                                                                )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    try {
                                                                        setLoadingAddons(true);
                                                                        await addProductAddon(productId, addon.id);
                                                                        const addonsData = await getProductAddons(productId);
                                                                        setProductAddons(addonsData.addons);
                                                                    } catch (err) {
                                                                        setError(err instanceof Error ? err.message : 'Failed to add addon');
                                                                    } finally {
                                                                        setLoadingAddons(false);
                                                                    }
                                                                }}
                                                                disabled={loadingAddons}
                                                            >
                                                                Add
                        </Button>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {availableAddonRules.length === 0 && productAddons.length === 0 && (
                                    <p className="text-sm text-gray-500">No addons available for this product&apos;s category.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Pricing Rule Section (if product is generated from pricing rule) */}
                    {pricingRule && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Source Pricing Rule</CardTitle>
                                    <Link
                                        href={`/categories/${formData?.categoryId}/pricing`}
                                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Edit in Category
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        This product is generated from a pricing rule. You can update the pricing rule here, or edit it in the category pricing page.
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="rule-base-price">Base Price (₹)</Label>
                                        <Input
                                            id="rule-base-price"
                                            type="number"
                                            step="0.01"
                                            value={pricingRuleForm.basePrice}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    basePrice: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="rule-price-modifier">Price Modifier (₹)</Label>
                                        <Input
                                            id="rule-price-modifier"
                                            type="number"
                                            step="0.01"
                                            value={pricingRuleForm.priceModifier}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    priceModifier: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="rule-min-quantity">Min Quantity</Label>
                                        <Input
                                            id="rule-min-quantity"
                                            type="number"
                                            value={pricingRuleForm.minQuantity}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    minQuantity: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="rule-max-quantity">Max Quantity</Label>
                                        <Input
                                            id="rule-max-quantity"
                                            type="number"
                                            value={pricingRuleForm.maxQuantity}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    maxQuantity: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="rule-priority">Priority</Label>
                                        <Input
                                            id="rule-priority"
                                            type="number"
                                            value={pricingRuleForm.priority}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    priority: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            id="rule-quantity-multiplier"
                                            type="checkbox"
                                            checked={pricingRuleForm.quantityMultiplier}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    quantityMultiplier: e.target.checked,
                                                }))
                                            }
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <Label htmlFor="rule-quantity-multiplier">Quantity Multiplier</Label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            id="rule-is-active"
                                            type="checkbox"
                                            checked={pricingRuleForm.isActive}
                                            onChange={(e) =>
                                                setPricingRuleForm((prev) => ({
                                                    ...prev,
                                                    isActive: e.target.checked,
                                                }))
                                            }
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <Label htmlFor="rule-is-active">Active</Label>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            if (!pricingRule || !formData?.categoryId) return;
                                            
                                            try {
                                                await toastPromise(
                                                    updateCategoryPricingRuleApi(formData.categoryId, pricingRule.id, {
                                                        basePrice: pricingRuleForm.basePrice ? Number(pricingRuleForm.basePrice) : null,
                                                        priceModifier: pricingRuleForm.priceModifier ? Number(pricingRuleForm.priceModifier) : null,
                                                        quantityMultiplier: pricingRuleForm.quantityMultiplier,
                                                        minQuantity: pricingRuleForm.minQuantity ? Number(pricingRuleForm.minQuantity) : null,
                                                        maxQuantity: pricingRuleForm.maxQuantity ? Number(pricingRuleForm.maxQuantity) : null,
                                                        isActive: pricingRuleForm.isActive,
                                                        priority: Number(pricingRuleForm.priority) || 0,
                                                    }),
                                                    {
                                                        loading: 'Updating pricing rule...',
                                                        success: 'Pricing rule updated successfully',
                                                        error: 'Failed to update pricing rule',
                                                    }
                                                );
                                                
                                                // Reload pricing rule
                                                const rules = await getCategoryPricingRulesApi(formData.categoryId);
                                                const updatedRule = rules.find(r => r.id === pricingRule.id);
                                                if (updatedRule) {
                                                    setPricingRule(updatedRule);
                                                    setPricingRuleForm({
                                                        basePrice: updatedRule.basePrice != null ? String(updatedRule.basePrice) : '',
                                                        priceModifier: updatedRule.priceModifier != null ? String(updatedRule.priceModifier) : '',
                                                        quantityMultiplier: updatedRule.quantityMultiplier,
                                                        minQuantity: updatedRule.minQuantity != null ? String(updatedRule.minQuantity) : '',
                                                        maxQuantity: updatedRule.maxQuantity != null ? String(updatedRule.maxQuantity) : '',
                                                        isActive: updatedRule.isActive,
                                                        priority: String(updatedRule.priority ?? 0),
                                                    });
                                                }
                                            } catch (err) {
                                                // Error handled by toast
                                            }
                                        }}
                                    >
                                        Update Pricing Rule
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Footer actions */}
                    <div className="flex items-center justify-between pt-4">
                        <div />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={isSubmitting}>
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

function mapProductToFormData(product: Product): CreateProductData {
    return {
        name: product.name,
        slug: product.slug || undefined,
        shortDescription: product.shortDescription || undefined,
        description: product.description || undefined,
        isActive: product.isActive,
        categoryId: product.categoryId,
        basePrice: product.basePrice,
        sellingPrice: product.sellingPrice ?? undefined,
        mrp: product.mrp ?? undefined,
        returnPolicy: product.returnPolicy || undefined,
        warranty: product.warranty || undefined,
        sku: product.sku || undefined,
        stock: product.stock,
        minOrderQuantity: product.minOrderQuantity,
        maxOrderQuantity: product.maxOrderQuantity ?? undefined,
        weight: product.weight ?? undefined,
        dimensions: product.dimensions || undefined,
        isFeatured: product.isFeatured,
        isNewArrival: product.isNewArrival,
        isBestSeller: product.isBestSeller,
        images: product.images.map((img) => ({
            url: img.url,
            alt: img.alt || undefined,
            isPrimary: img.isPrimary,
            displayOrder: img.displayOrder,
        })),
        specifications: product.specifications.map((spec) => ({
            key: spec.key,
            value: spec.value,
            displayOrder: spec.displayOrder,
        })),
        attributes: product.attributes.map((attr) => ({
            type: attr.attributeType,
            value: attr.attributeValue,
        })),
        tags: product.tags.map((tag) => tag.tag),
        variants: product.variants.map((variant) => ({
            name: variant.name,
            sku: variant.sku || undefined,
            stock: variant.stock,
            priceModifier: variant.priceModifier,
            available: variant.available,
        })),
    };
}


