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
    type CreateProductData,
    type Product,
    type ProductImage,
} from '@/lib/api/products.service';
import { getCategories, type Category, type PaginatedCategories } from '@/lib/api/categories.service';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';

interface EditProductFormProps {
    productId: string;
}

export function EditProductForm({ productId }: EditProductFormProps) {
    const router = useRouter();
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
        <Card>
            <CardHeader>
                <CardTitle>Edit Product</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                    {error && (
                        <Alert variant="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {/* Basic Information */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Product Information
                        </h2>
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
                    </section>

                    {/* Classification & Pricing */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Classification & Pricing
                        </h2>
                        <div className="grid gap-4 md:grid-cols-[2fr,3fr]">
                            <div className="space-y-2">
                                <Label htmlFor="category">Product Category *</Label>
                                <select
                                    id="category"
                                    className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                                    value={formData.categoryId}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? { ...prev, categoryId: e.target.value }
                                                : prev,
                                        )
                                    }
                                    required
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Choose the primary category this product belongs to.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="categorySearch">Search Categories</Label>
                                <Input
                                    id="categorySearch"
                                    placeholder="Search by category name or slug..."
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                />
                                {categoriesLoading && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Loading categories…
                                    </p>
                                )}
                            </div>
                        </div>

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
                    </section>

                    {/* Inventory & Logistics */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Inventory & Logistics
                        </h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input
                                    id="sku"
                                    value={formData.sku || ''}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, sku: e.target.value || undefined } : prev,
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stock">Stock *</Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    min="0"
                                    value={formData.stock}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    stock: Number(e.target.value || 0),
                                                }
                                                : prev,
                                        )
                                    }
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="minOrderQuantity">Min Order Quantity *</Label>
                                <Input
                                    id="minOrderQuantity"
                                    type="number"
                                    min="1"
                                    value={formData.minOrderQuantity}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    minOrderQuantity: Number(
                                                        e.target.value || 1,
                                                    ),
                                                }
                                                : prev,
                                        )
                                    }
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="maxOrderQuantity">Max Order Quantity</Label>
                                <Input
                                    id="maxOrderQuantity"
                                    type="number"
                                    min={formData.minOrderQuantity || 1}
                                    value={formData.maxOrderQuantity ?? ''}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    maxOrderQuantity:
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
                                <Label htmlFor="weight">Weight (kg)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.weight ?? ''}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    weight:
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
                                <Label htmlFor="dimensions">Dimensions</Label>
                                <Input
                                    id="dimensions"
                                    placeholder="length x width x height cm"
                                    value={formData.dimensions || ''}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? { ...prev, dimensions: e.target.value }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </section>

                    {/* Merchandising & SEO */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Merchandising & SEO
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center gap-2">
                                <input
                                    id="isActive"
                                    type="checkbox"
                                    checked={formData.isActive ?? true}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, isActive: e.target.checked } : prev,
                                        )
                                    }
                                />
                                <Label htmlFor="isActive">Active (visible in storefront)</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="isFeatured"
                                    type="checkbox"
                                    checked={formData.isFeatured ?? false}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, isFeatured: e.target.checked } : prev,
                                        )
                                    }
                                />
                                <Label htmlFor="isFeatured">Featured</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="isNewArrival"
                                    type="checkbox"
                                    checked={formData.isNewArrival ?? false}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, isNewArrival: e.target.checked } : prev,
                                        )
                                    }
                                />
                                <Label htmlFor="isNewArrival">New Arrival</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="isBestSeller"
                                    type="checkbox"
                                    checked={formData.isBestSeller ?? false}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev ? { ...prev, isBestSeller: e.target.checked } : prev,
                                        )
                                    }
                                />
                                <Label htmlFor="isBestSeller">Best Seller</Label>
                            </div>
                        </div>
                    </section>

                    {/* Images */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">Images</h2>
                        <p className="text-sm text-muted-foreground">
                            Upload multiple images or add image URLs. Mark one as primary; others will be used as gallery images.
                        </p>

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
                    </section>

                    {/* Specifications */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">Specifications</h2>
                        <p className="text-sm text-muted-foreground">
                            Structured key/value specifications shown on the product page.
                        </p>
                        <div className="space-y-3">
                            {specifications.map((spec, index) => (
                                <div
                                    key={index}
                                    className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr,1fr,auto]"
                                >
                                    <div className="space-y-1">
                                        <Label>Key</Label>
                                        <Input
                                            value={spec.key}
                                            onChange={(e) => {
                                                const next = [...specifications];
                                                next[index] = {
                                                    ...next[index],
                                                    key: e.target.value ?? '',
                                                };
                                                setFormData((prev) =>
                                                    prev
                                                        ? { ...prev, specifications: next }
                                                        : prev,
                                                );
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Value</Label>
                                        <Input
                                            value={spec.value}
                                            onChange={(e) => {
                                                const next = [...specifications];
                                                next[index] = {
                                                    ...next[index],
                                                    value: e.target.value ?? '',
                                                };
                                                setFormData((prev) =>
                                                    prev
                                                        ? { ...prev, specifications: next }
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
                                                const next = specifications.filter(
                                                    (_, i) => i !== index,
                                                );
                                                setFormData((prev) =>
                                                    prev
                                                        ? { ...prev, specifications: next }
                                                        : prev,
                                                );
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setFormData((prev) =>
                                    prev
                                        ? {
                                            ...prev,
                                            specifications: [
                                                ...(prev.specifications || []),
                                                {
                                                    key: '',
                                                    value: '',
                                                    displayOrder: prev.specifications
                                                        ? prev.specifications.length
                                                        : 0,
                                                },
                                            ],
                                        }
                                        : prev,
                                )
                            }
                        >
                            Add Specification
                        </Button>
                    </section>

                    {/* Attributes & Tags */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">
                            Attributes & Tags
                        </h2>
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
                    </section>

                    {/* Variants */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">Variants</h2>
                        <p className="text-sm text-muted-foreground">
                            Configure product variants with per-variant stock and price modifiers.
                        </p>
                        <div className="space-y-3">
                            {variants.map((variant, index) => {
                                const variantPriceModifier = variant.priceModifier ?? 0;
                                const finalPrice =
                                    (formData.basePrice || 0) + variantPriceModifier;

                                return (
                                    <div
                                        key={index}
                                        className="grid gap-3 rounded-md border p-3 md:grid-cols-[1.5fr,1fr,1fr,auto]"
                                    >
                                        <div className="space-y-1">
                                            <Label>Variant Name *</Label>
                                            <Input
                                                placeholder="e.g. A4 – 70 Gsm – Color"
                                                value={variant.name}
                                                onChange={(e) => {
                                                    const next = [...variants];
                                                    next[index] = {
                                                        ...next[index],
                                                        name: e.target.value ?? '',
                                                    };
                                                    setFormData((prev) =>
                                                        prev ? { ...prev, variants: next } : prev,
                                                    );
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>SKU</Label>
                                            <Input
                                                value={variant.sku || ''}
                                                onChange={(e) => {
                                                    const next = [...variants];
                                                    next[index] = {
                                                        ...next[index],
                                                        sku: e.target.value || undefined,
                                                    };
                                                    setFormData((prev) =>
                                                        prev ? { ...prev, variants: next } : prev,
                                                    );
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Stock & Price Modifier</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Stock"
                                                    value={variant.stock ?? 0}
                                                    onChange={(e) => {
                                                        const next = [...variants];
                                                        next[index] = {
                                                            ...next[index],
                                                            stock: Number(e.target.value || 0),
                                                        };
                                                        setFormData((prev) =>
                                                            prev
                                                                ? { ...prev, variants: next }
                                                                : prev,
                                                        );
                                                    }}
                                                />
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="+/- Price"
                                                    value={variant.priceModifier ?? 0}
                                                    onChange={(e) => {
                                                        const next = [...variants];
                                                        next[index] = {
                                                            ...next[index],
                                                            priceModifier: Number(
                                                                e.target.value || 0,
                                                            ),
                                                        };
                                                        setFormData((prev) =>
                                                            prev
                                                                ? { ...prev, variants: next }
                                                                : prev,
                                                        );
                                                    }}
                                                />
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Final price estimate:{' '}
                                                <span className="font-medium">
                                                    ₹
                                                    {Number.isFinite(finalPrice)
                                                        ? finalPrice.toFixed(2)
                                                        : '—'}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex flex-col justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={variant.available ?? true}
                                                    onChange={(e) => {
                                                        const next = [...variants];
                                                        next[index] = {
                                                            ...next[index],
                                                            available: e.target.checked,
                                                        };
                                                        setFormData((prev) =>
                                                            prev
                                                                ? { ...prev, variants: next }
                                                                : prev,
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs">Available</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const next = variants.filter(
                                                        (_, i) => i !== index,
                                                    );
                                                    setFormData((prev) =>
                                                        prev
                                                            ? { ...prev, variants: next }
                                                            : prev,
                                                    );
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setFormData((prev) =>
                                    prev
                                        ? {
                                            ...prev,
                                            variants: [
                                                ...(prev.variants || []),
                                                {
                                                    name: '',
                                                    sku: undefined,
                                                    stock: 0,
                                                    priceModifier: 0,
                                                    available: true,
                                                },
                                            ],
                                        }
                                        : prev,
                                )
                            }
                        >
                            Add Variant
                        </Button>
                    </section>

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
            </CardContent>
        </Card>
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


