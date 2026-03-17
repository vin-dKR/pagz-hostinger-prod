'use client';

/**
 * Carousel Form Component
 * For creating and editing carousel items
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import {
    createCarouselApi,
    updateCarouselApi,
    uploadCarouselImageApi,
    getCarouselApi,
    type CreateCarouselData,
    type UpdateCarouselData,
} from '@/lib/api/carousel.service';
import { getCategories, type Category } from '@/lib/api/categories.service';
import Image from 'next/image';
import { Upload, X, Loader2 } from 'lucide-react';
import { toastPromise } from '@/lib/utils/toast';

interface CarouselFormProps {
    carouselId?: string;
}

export function CarouselForm({ carouselId }: CarouselFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingCarousel, setIsLoadingCarousel] = useState(!!carouselId);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<{
        imageUrl: string;
        alt: string;
        categoryId: string;
        displayOrder: number;
        isActive: boolean;
    }>({
        imageUrl: '',
        alt: '',
        categoryId: '',
        displayOrder: 0,
        isActive: true,
    });

    // Load categories
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const data = await getCategories({ page: 1, limit: 1000 });
                setCategories(data.items.filter((cat) => cat.isActive));
            } catch (err) {
                console.error('Failed to load categories:', err);
            }
        };
        loadCategories();
    }, []);

    // Load carousel if editing
    useEffect(() => {
        if (carouselId) {
            const loadCarousel = async () => {
                try {
                    setIsLoadingCarousel(true);
                    setError(null);
                    const carousel = await getCarouselApi(carouselId);
                    // Update form data with loaded carousel data
                    setFormData({
                        imageUrl: carousel?.imageUrl || '',
                        alt: carousel?.alt || '',
                        categoryId: carousel?.categoryId || '',
                        displayOrder: carousel?.displayOrder ?? 0,
                        isActive: carousel?.isActive ?? true,
                    });
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to load carousel';
                    setError(errorMessage);
                    // Reset form on error
                    setFormData({
                        imageUrl: '',
                        alt: '',
                        categoryId: '',
                        displayOrder: 0,
                        isActive: true,
                    });
                } finally {
                    setIsLoadingCarousel(false);
                }
            };
            loadCarousel();
        } else {
            setFormData({
                imageUrl: '',
                alt: '',
                categoryId: '',
                displayOrder: 0,
                isActive: true,
            });
        }
    }, [carouselId]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Please upload JPG, PNG, WebP, or GIF images.');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB.');
            return;
        }

        try {
            setUploadingImage(true);
            setError(null);

            const result = await uploadCarouselImageApi(file, {
                alt: formData.alt || undefined,
            });

            setFormData((prev) => ({
                ...prev,
                imageUrl: result.url,
                alt: result.alt || prev.alt,
            }));

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (!formData.imageUrl) {
                setError('Please upload an image');
                setIsLoading(false);
                return;
            }

            if (carouselId) {
                const updatePayload: UpdateCarouselData = {
                    imageUrl: formData.imageUrl,
                    alt: formData.alt.trim() || null,
                    categoryId: formData.categoryId && formData.categoryId.trim() ? formData.categoryId : null,
                    displayOrder: formData.displayOrder,
                    isActive: formData.isActive,
                };
                await toastPromise(
                    updateCarouselApi(carouselId, updatePayload),
                    {
                        loading: 'Updating carousel item...',
                        success: 'Carousel item updated successfully',
                        error: 'Failed to update carousel item',
                    }
                );
            } else {
                const createPayload: CreateCarouselData = {
                    imageUrl: formData.imageUrl,
                    alt: formData.alt.trim() || undefined,
                    categoryId: formData.categoryId && formData.categoryId.trim() ? formData.categoryId : null,
                    displayOrder: formData.displayOrder,
                    isActive: formData.isActive,
                };
                await toastPromise(
                    createCarouselApi(createPayload),
                    {
                        loading: 'Creating carousel item...',
                        success: 'Carousel item created successfully',
                        error: 'Failed to create carousel item',
                    }
                );
            }

            router.push('/carousels');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save carousel');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoadingCarousel) {
        return <div className="text-center py-12">Loading carousel...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{carouselId ? 'Edit Carousel Item' : 'Create Carousel Item'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <Alert variant="error">
                            {error}
                        </Alert>
                    )}

                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label htmlFor="image">Image *</Label>
                        {formData.imageUrl ? (
                            <div className="relative inline-block">
                                <Image
                                    src={formData.imageUrl}
                                    alt={formData.alt || 'Carousel preview'}
                                    width={400}
                                    height={250}
                                    className="rounded-lg object-cover border border-gray-200"
                                />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-sm text-gray-600 mb-2">
                                    Click to upload or drag and drop
                                </p>
                                <p className="text-xs text-gray-500 mb-4">
                                    PNG, JPG, WebP, GIF up to 10MB
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                >
                                    {uploadingImage ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        'Select Image'
                                    )}
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>
                        )}
                    </div>

                    {/* Alt Text */}
                    <div className="space-y-2">
                        <Label htmlFor="alt">Alt Text</Label>
                        <Input
                            id="alt"
                            value={formData.alt}
                            onChange={(e) => setFormData((prev) => ({ ...prev, alt: e.target.value }))}
                            placeholder="Description for the image"
                        />
                        <p className="text-xs text-gray-500">
                            Optional: A brief description of the image for accessibility
                        </p>
                    </div>

                    {/* Category Link */}
                    <div className="space-y-2">
                        <Label htmlFor="categoryId">Link to Category (Optional)</Label>
                        <select
                            id="categoryId"
                            value={formData.categoryId}
                            onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">No category link</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500">
                            When users click "Order Now", they will be redirected to this category page
                        </p>
                    </div>

                    {/* Display Order */}
                    <div className="space-y-2">
                        <Label htmlFor="displayOrder">Display Order</Label>
                        <Input
                            id="displayOrder"
                            type="number"
                            value={formData.displayOrder}
                            onChange={(e) => setFormData((prev) => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                            min="0"
                        />
                        <p className="text-xs text-gray-500">
                            Lower numbers appear first. You can also reorder items from the list page.
                        </p>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <Label htmlFor="isActive" className="cursor-pointer">
                            Active (visible on homepage)
                        </Label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-4">
                        <Button
                            type="submit"
                            disabled={isLoading || uploadingImage || !formData.imageUrl}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                carouselId ? 'Update Carousel' : 'Create Carousel'
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push('/carousels')}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
