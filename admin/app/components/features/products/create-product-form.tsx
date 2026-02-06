'use client';

/**
 * Create Product Wizard
 * Multi-step flow for creating new products covering core fields
 * and related metadata (images, specifications, attributes, tags).
 */

import { useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { createProduct, type CreateProductData, uploadProductImageApi } from '@/lib/api/products.service';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';

type WizardStep =
    | 1 // Basic info
    | 2 // Classification & pricing
    | 3 // Inventory & logistics
    | 4 // Merchandising & SEO
    | 5 // Images
    | 6 // Specifications
    | 7 // Attributes & tags
    | 8 // Variants
    | 9; // Review & publish

const TOTAL_STEPS: WizardStep = 9;

export function CreateProductForm() {
    const router = useRouter();
    const [step, setStep] = useState<WizardStep>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categoryImagesLoaded, setCategoryImagesLoaded] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [fileMetadata, setFileMetadata] = useState<Map<number, { alt: string; isPrimary: boolean }>>(new Map());
    const [uploadingImages, setUploadingImages] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<CreateProductData>({
        // Step 1
        name: '',
        slug: '',
        shortDescription: '',
        description: '',
        isActive: true,

        // Step 2
        categoryId: '',
        basePrice: 0,
        sellingPrice: undefined,
        mrp: undefined,
        returnPolicy: '',
        warranty: '',

        // Step 3
        sku: '',
        stock: 0,
        minOrderQuantity: 1,
        maxOrderQuantity: undefined,
        weight: undefined,
        dimensions: '',

        // Step 4
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,

        // Step 5–7
        images: [],
        specifications: [],
        attributes: [],
        tags: [],
        // Step 8
        variants: [],
    });

    const goNext = async () => {
        // When moving to step 5 (Images), load category images if category is selected and images haven't been loaded yet
        if (step === 4 && formData.categoryId && !categoryImagesLoaded && formData.images?.length === 0) {
            try {
                const { getCategoryById, getCategoryImagesApi } = await import('@/lib/api/categories.service');
                const category = await getCategoryById(formData.categoryId);

                // Fetch all category images separately (API only returns primary image in getCategories)
                const categoryImages = await getCategoryImagesApi(formData.categoryId);

                if (categoryImages && categoryImages.length > 0) {
                    // Convert category images to product images format
                    const productImages = categoryImages.map((img, index) => ({
                        url: img.url,
                        alt: img.alt || `${category.name} image ${index + 1}`,
                        isPrimary: img.isPrimary || index === 0,
                        displayOrder: img.displayOrder !== undefined ? img.displayOrder : index,
                    }));

                    setFormData((prev) => ({
                        ...prev,
                        images: productImages,
                    }));
                    setCategoryImagesLoaded(true);
                }
            } catch (err) {
                console.error('Failed to load category images:', err);
                // Continue anyway - user can add images manually
            }
        }

        setStep((prev) => {
            const next = (prev + 1) as WizardStep;
            return next > TOTAL_STEPS ? TOTAL_STEPS : next;
        });
    };

    const goPrev = () => {
        setStep((prev) => {
            const next = (prev - 1) as WizardStep;
            return next < 1 ? 1 : next;
        });
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // Require at least one image before final publish
            if (!formData.images || formData.images.length === 0) {
                setError('Please add at least one product image before creating the product.');
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

            const createdProduct = await createProduct(payload);

            // Upload selected files if any
            if (selectedFiles.length > 0 && createdProduct?.id) {
                setUploadingImages(true);
                try {
                    for (let i = 0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];
                        if (!file) continue;

                        const metadata = fileMetadata.get(i) || { alt: '', isPrimary: false };
                        await uploadProductImageApi(createdProduct.id, file, {
                            alt: metadata.alt.trim() || undefined,
                            isPrimary: metadata.isPrimary || (i === 0 && formData.images?.length === 0),
                        });
                    }
                } catch (uploadErr) {
                    console.error('Failed to upload some images:', uploadErr);
                    // Continue anyway - product is created, images can be added later
                } finally {
                    setUploadingImages(false);
                }
            }

            router.push('/products');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create product');
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepTitle = () => {
        switch (step) {
            case 1:
                return 'Step 1: Product Information';
            case 2:
                return 'Step 2: Classification & Pricing';
            case 3:
                return 'Step 3: Inventory & Logistics';
            case 4:
                return 'Step 4: Merchandising & SEO';
            case 5:
                return 'Step 5: Images';
            case 6:
                return 'Step 6: Specifications';
            case 7:
                return 'Step 7: Attributes & Tags';
            case 8:
                return 'Step 8: Variants';
            case 9:
                return 'Step 9: Review & Publish';
            default:
                return 'Create Product';
        }
    };

    const renderStep = () => {
        if (step === 1) {
            return (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, name: e.target.value }))
                            }
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                            id="slug"
                            value={formData.slug}
                            placeholder="auto-generated from name if left empty"
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, slug: e.target.value }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="shortDescription">Short Description</Label>
                        <Input
                            id="shortDescription"
                            value={formData.shortDescription}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, description: e.target.value }))
                            }
                        />
                    </div>
                </div>
            );
        }

        if (step === 2) {
            const discountPercentage =
                formData.mrp && formData.sellingPrice
                    ? Math.max(
                        0,
                        Math.round(
                            ((Number(formData.mrp) - Number(formData.sellingPrice)) /
                                Number(formData.mrp)) *
                            100,
                        ),
                    )
                    : null;

            return (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Category ID *</Label>
                            <Input
                                id="categoryId"
                                value={formData.categoryId}
                                onChange={(e) => {
                                    setFormData((prev) => ({ ...prev, categoryId: e.target.value }));
                                    // Reset category images loaded flag when category changes
                                    setCategoryImagesLoaded(false);
                                }}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Start by pasting an existing category ID; category picker will be added
                                later.
                            </p>
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        basePrice: Number(e.target.value || 0),
                                    }))
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        sellingPrice:
                                            e.target.value === '' ? undefined : Number(e.target.value),
                                    }))
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        mrp: e.target.value === '' ? undefined : Number(e.target.value),
                                    }))
                                }
                            />
                            {discountPercentage !== null && (
                                <p className="text-xs text-emerald-600">
                                    Approx. discount: {discountPercentage}% off MRP
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="returnPolicy">Return Policy</Label>
                        <textarea
                            id="returnPolicy"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.returnPolicy || ''}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, returnPolicy: e.target.value }))
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
                                setFormData((prev) => ({ ...prev, warranty: e.target.value }))
                            }
                        />
                    </div>
                </div>
            );
        }

        if (step === 3) {
            return (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="sku">SKU</Label>
                            <Input
                                id="sku"
                                value={formData.sku || ''}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, sku: e.target.value || undefined }))
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        stock: Number(e.target.value || 0),
                                    }))
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        minOrderQuantity: Number(e.target.value || 1),
                                    }))
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        maxOrderQuantity:
                                            e.target.value === '' ? undefined : Number(e.target.value),
                                    }))
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
                                    setFormData((prev) => ({
                                        ...prev,
                                        weight:
                                            e.target.value === '' ? undefined : Number(e.target.value),
                                    }))
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
                                    setFormData((prev) => ({ ...prev, dimensions: e.target.value }))
                                }
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (step === 4) {
            return (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-2">
                            <input
                                id="isActive"
                                type="checkbox"
                                checked={formData.isActive ?? true}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
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
                                    setFormData((prev) => ({ ...prev, isFeatured: e.target.checked }))
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
                                    setFormData((prev) => ({ ...prev, isNewArrival: e.target.checked }))
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
                                    setFormData((prev) => ({ ...prev, isBestSeller: e.target.checked }))
                                }
                            />
                            <Label htmlFor="isBestSeller">Best Seller</Label>
                        </div>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                            Slug-based product URL preview:{' '}
                            <span className="font-mono text-xs">
                                /products/{formData.slug || 'auto-generated'}
                            </span>
                        </p>
                    </div>
                </div>
            );
        }

        if (step === 5) {
            const images = formData.images || [];

            const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                        isPrimary: images.length === 0 && globalIndex === 0, // First file is primary if no existing images
                    });
                });
                setFileMetadata(newMetadata);
            };

            const updateFileMetadata = (index: number, updates: Partial<{ alt: string; isPrimary: boolean }>) => {
                const newMetadata = new Map(fileMetadata);
                const current = newMetadata.get(index) || { alt: '', isPrimary: false };
                newMetadata.set(index, { ...current, ...updates });

                // If setting as primary, unset others
                if (updates.isPrimary) {
                    newMetadata.forEach((meta, idx) => {
                        if (idx !== index) {
                            newMetadata.set(idx, { ...meta, isPrimary: false });
                        }
                    });
                }
                setFileMetadata(newMetadata);
            };

            const handleRemoveFile = (index: number) => {
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
            };

            const handleUploadFiles = async () => {
                if (selectedFiles.length === 0) {
                    setError('Please select at least one file to upload');
                    return;
                }

                // Note: We can't upload to S3 until product is created (no productId yet)
                // Files and metadata will be stored in state and uploaded after product creation
                // This is handled in handleSubmit
            };

            return (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Upload multiple images or add image URLs. You can set one as primary and add alt text for each.
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
                                onChange={handleFileSelect}
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
                                                    onClick={() => handleRemoveFile(index)}
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
                                                        onChange={(e) => updateFileMetadata(index, { alt: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id={`is-primary-${index}`}
                                                        type="checkbox"
                                                        checked={metadata.isPrimary || isFirstFile}
                                                        onChange={(e) => updateFileMetadata(index, { isPrimary: e.target.checked })}
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
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected.
                                    Will be uploaded after product creation.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedFiles([]);
                                        setFileMetadata(new Map());
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = '';
                                        }
                                    }}
                                >
                                    Clear All
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Existing Images (from URLs or category) */}
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
                                        <Label>Image URL</Label>
                                        <Input
                                            value={img.url}
                                            onChange={(e) => {
                                                const next = [...images];
                                                next[index] = {
                                                    ...next[index],
                                                    url: e.target.value ?? '',
                                                };
                                                setFormData((prev) => ({ ...prev, images: next }));
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Alt text</Label>
                                        <Input
                                            value={img.alt || ''}
                                            onChange={(e) => {
                                                const next = [...images];
                                                next[index] = { ...next[index], alt: e.target.value };
                                                setFormData((prev) => ({ ...prev, images: next }));
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
                                                    setFormData((prev) => ({ ...prev, images: next }));
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
                                                setFormData((prev) => ({ ...prev, images: next }));
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            setFormData((prev) => ({
                                ...prev,
                                images: [
                                    ...(prev.images || []),
                                    {
                                        url: '',
                                        alt: '',
                                        isPrimary: images.length === 0,
                                        displayOrder: prev.images ? prev.images.length : 0,
                                    },
                                ],
                            }))
                        }
                    >
                        Add Image URL
                    </Button>
                </div>
            );
        }

        if (step === 6) {
            const specifications = formData.specifications || [];

            return (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Define key/value specifications such as Material, Size, Pages, etc.
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
                                            setFormData((prev) => ({ ...prev, specifications: next }));
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
                                            setFormData((prev) => ({ ...prev, specifications: next }));
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
                                            const next = specifications.filter((_, i) => i !== index);
                                            setFormData((prev) => ({ ...prev, specifications: next }));
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
                            setFormData((prev) => ({
                                ...prev,
                                specifications: [
                                    ...(prev.specifications || []),
                                    { key: '', value: '', displayOrder: prev.specifications ? prev.specifications.length : 0 },
                                ],
                            }))
                        }
                    >
                        Add Specification
                    </Button>
                </div>
            );
        }

        if (step === 7) {
            const attributes = formData.attributes || [];
            const tags = formData.tags || [];

            return (
                <div className="space-y-6">
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
                                            setFormData((prev) => ({ ...prev, attributes: next }));
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
                                            setFormData((prev) => ({ ...prev, attributes: next }));
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
                                            const next = attributes.filter((_, i) => i !== index);
                                            setFormData((prev) => ({ ...prev, attributes: next }));
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
                                setFormData((prev) => ({
                                    ...prev,
                                    attributes: [
                                        ...(prev.attributes || []),
                                        { type: '', value: '' },
                                    ],
                                }))
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
                                            setFormData((prev) => ({ ...prev, tags: next }));
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
                                        setFormData((prev) => ({
                                            ...prev,
                                            tags: [...(prev.tags || []), value],
                                        }));
                                    }
                                    (e.target as HTMLInputElement).value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            );
        }

        if (step === 8) {
            const variants = formData.variants || [];

            return (
                <div className="space-y-6">
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
                                                setFormData((prev) => ({ ...prev, variants: next }));
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
                                                setFormData((prev) => ({ ...prev, variants: next }));
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
                                                    setFormData((prev) => ({ ...prev, variants: next }));
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
                                                        priceModifier: Number(e.target.value || 0),
                                                    };
                                                    setFormData((prev) => ({ ...prev, variants: next }));
                                                }}
                                            />
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Final price estimate:{' '}
                                            <span className="font-medium">
                                                ₹{Number.isFinite(finalPrice) ? finalPrice.toFixed(2) : '—'}
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
                                                    setFormData((prev) => ({ ...prev, variants: next }));
                                                }}
                                            />
                                            <span className="text-xs">Available</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const next = variants.filter((_, i) => i !== index);
                                                setFormData((prev) => ({ ...prev, variants: next }));
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
                            setFormData((prev) => ({
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
                            }))
                        }
                    >
                        Add Variant
                    </Button>
                </div>
            );
        }

        // Step 9: Review & Publish
        return (
            <div className="space-y-6 text-sm">
                <p className="text-muted-foreground">
                    Review the key details before creating the product. You can edit later from the
                    product detail page.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <p className="font-semibold">Basic Info</p>
                        <div>
                            <span className="text-gray-600">Name: </span>
                            <span className="font-medium">{formData.name || '-'}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Slug: </span>
                            <span className="font-mono text-xs">
                                {formData.slug || '(auto-generated)'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">Category ID: </span>
                            <span className="font-mono text-xs">
                                {formData.categoryId || '(not set)'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="font-semibold">Pricing</p>
                        <div>
                            <span className="text-gray-600">Base Price: </span>
                            <span className="font-medium">
                                {formData.basePrice ? `₹${formData.basePrice}` : '-'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">Selling Price: </span>
                            <span className="font-medium">
                                {formData.sellingPrice ? `₹${formData.sellingPrice}` : '-'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">MRP: </span>
                            <span className="font-medium">
                                {formData.mrp ? `₹${formData.mrp}` : '-'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="font-semibold">Inventory</p>
                        <div>
                            <span className="text-gray-600">Stock: </span>
                            <span className="font-medium">{formData.stock}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">MOQ: </span>
                            <span className="font-medium">{formData.minOrderQuantity}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Max Order Quantity: </span>
                            <span className="font-medium">
                                {formData.maxOrderQuantity ?? '(no limit)'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="font-semibold">Media & Metadata</p>
                        <div>
                            <span className="text-gray-600">Images: </span>
                            <span className="font-medium">{formData.images?.length || 0}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Specifications: </span>
                            <span className="font-medium">{formData.specifications?.length || 0}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Attributes: </span>
                            <span className="font-medium">{formData.attributes?.length || 0}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Tags: </span>
                            <span className="font-medium">{formData.tags?.length || 0}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Variants: </span>
                            <span className="font-medium">{formData.variants?.length || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const canGoNext = () => {
        if (step === 1) {
            return !!formData.name;
        }
        if (step === 2) {
            return !!formData.name && !!formData.categoryId && formData.basePrice > 0;
        }
        if (step === 3) {
            return formData.stock >= 0 && formData.minOrderQuantity >= 1;
        }
        return true;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{renderStepTitle()}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                    Step {step} of {TOTAL_STEPS}
                </p>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <Alert variant="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {renderStep()}

                    <div className="flex items-center justify-between pt-4">
                        <div className="flex gap-2">
                            {step > 1 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={goPrev}
                                    disabled={isLoading}
                                >
                                    Previous
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            {step < TOTAL_STEPS ? (
                                <Button
                                    type="button"
                                    onClick={goNext}
                                    disabled={isLoading || !canGoNext()}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button type="submit" isLoading={isLoading}>
                                    Create Product
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}


