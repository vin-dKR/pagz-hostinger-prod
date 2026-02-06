'use client';

/**
 * Category Images Management Component
 */

import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import {
    getCategoryImagesApi,
    updateCategoryImageApi,
    deleteCategoryImageApi,
    uploadCategoryImageApi,
    type CategoryImage,
} from '@/lib/api/categories.service';
import Image from 'next/image';
import { Trash2, Star, StarOff, GripVertical } from 'lucide-react';
import { toastPromise } from '@/lib/utils/toast';
import { useConfirm } from '@/lib/hooks/use-confirm';

interface CategoryImagesProps {
    categoryId: string;
}

export function CategoryImages({ categoryId }: CategoryImagesProps) {
    const [images, setImages] = useState<CategoryImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [fileMetadata, setFileMetadata] = useState<Map<number, { alt: string; isPrimary: boolean }>>(new Map());
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        loadImages();
    }, [categoryId]);

    const loadImages = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getCategoryImagesApi(categoryId);
            setImages(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load images');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: FormEvent) => {
        e.preventDefault();
        if (selectedFiles.length === 0) {
            setError('Please select at least one file');
            return;
        }

        // Validate all files
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        for (const file of selectedFiles) {
            if (!allowedTypes.includes(file.type)) {
                setError(`Invalid file type: ${file.name}. Please upload JPG, PNG, WebP, or GIF images.`);
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError(`File size too large: ${file.name}. Max size is 10MB.`);
                return;
            }
        }

        try {
            setUploading(true);
            setError(null);
            setUploadProgress(0);

            const uploadedImages: CategoryImage[] = [];

            // Upload all files sequentially
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                if (!file) continue; // Skip if file is undefined

                const metadata = fileMetadata.get(i) || { alt: '', isPrimary: false };

                const newImage = await uploadCategoryImageApi(categoryId, file, {
                    alt: metadata.alt.trim() || undefined,
                    isPrimary: metadata.isPrimary,
                });

                uploadedImages.push(newImage);
                setUploadProgress(((i + 1) / selectedFiles.length) * 100);
            }

            setImages([...images, ...uploadedImages]);
            setSelectedFiles([]);
            setFileMetadata(new Map());
            setUploadProgress(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload images');
        } finally {
            setUploading(false);
        }
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(files);
            // Initialize metadata for each file
            const newMetadata = new Map<number, { alt: string; isPrimary: boolean }>();
            files.forEach((_, index) => {
                newMetadata.set(index, { alt: '', isPrimary: index === 0 }); // First file is primary by default
            });
            setFileMetadata(newMetadata);
            setError(null);
        }
    };

    const updateFileMetadata = (index: number, updates: Partial<{ alt: string; isPrimary: boolean }>) => {
        setFileMetadata((prev) => {
            const newMap = new Map(prev);
            const current = newMap.get(index) || { alt: '', isPrimary: false };
            newMap.set(index, { ...current, ...updates });

            // If setting one as primary, unset others
            if (updates.isPrimary === true) {
                newMap.forEach((meta, idx) => {
                    if (idx !== index) {
                        newMap.set(idx, { ...meta, isPrimary: false });
                    }
                });
            }

            return newMap;
        });
    };

    const handleSetPrimary = async (imageId: string) => {
        try {
            setError(null);
            await updateCategoryImageApi(categoryId, imageId, { isPrimary: true });
            await loadImages(); // Reload to get updated order
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set primary image');
        }
    };

    const handleDelete = async (imageId: string) => {
        const confirmed = await confirm({
            title: 'Delete Image',
            description: 'Are you sure you want to delete this image? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    setDeleting(imageId);
                    setError(null);
                    await toastPromise(
                        deleteCategoryImageApi(categoryId, imageId),
                        {
                            loading: 'Deleting image...',
                            success: 'Image deleted successfully',
                            error: 'Failed to delete image',
                        }
                    );
                    setImages(images.filter((img) => img.id !== imageId));
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete image');
                } finally {
                    setDeleting(null);
                }
            },
        });
    };

    const handleUpdateDisplayOrder = async (imageId: string, newOrder: number) => {
        try {
            setError(null);
            await updateCategoryImageApi(categoryId, imageId, { displayOrder: newOrder });
            await loadImages();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update order');
        }
    };

    if (loading) {
        return (
            <>
                {ConfirmDialog}
                <div className="flex min-h-[200px] items-center justify-center">
                    <p className="text-sm text-gray-500">Loading images...</p>
                </div>
            </>
        );
    }

    return (
        <>
            {ConfirmDialog}
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Category Images</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Upload and manage images for this category. Set a primary image for display in listings.
                    </p>
                </div>

                {error && <Alert variant="error">{error}</Alert>}

                {/* Add Image Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Add New Image</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleFileUpload} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="image-files">Select Images (Multiple)</Label>
                                <Input
                                    id="image-files"
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                    onChange={handleFileChange}
                                    multiple
                                    required
                                />
                                <p className="text-xs text-gray-500">
                                    Supported formats: JPG, PNG, WebP, GIF. Max size per file: 10MB. You can select multiple images at once.
                                </p>
                            </div>

                            {/* File List with Individual Settings */}
                            {selectedFiles.length > 0 && (
                                <div className="space-y-4 rounded-md border p-4">
                                    <p className="text-sm font-medium text-gray-700">
                                        Configure {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''}:
                                    </p>
                                    <div className="space-y-4">
                                        {selectedFiles.map((file, index) => {
                                            const metadata = fileMetadata.get(index) || { alt: '', isPrimary: false };
                                            return (
                                                <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                                    <div className="mb-3 flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`alt-${index}`} className="text-xs">
                                                                Alt Text (optional)
                                                            </Label>
                                                            <Input
                                                                id={`alt-${index}`}
                                                                placeholder="Description for this image"
                                                                value={metadata.alt}
                                                                onChange={(e) => updateFileMetadata(index, { alt: e.target.value })}
                                                                className="text-sm"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                id={`primary-${index}`}
                                                                type="checkbox"
                                                                checked={metadata.isPrimary}
                                                                onChange={(e) => updateFileMetadata(index, { isPrimary: e.target.checked })}
                                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <Label htmlFor={`primary-${index}`} className="text-sm cursor-pointer">
                                                                Set as primary image
                                                            </Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <Button type="submit" isLoading={uploading} disabled={selectedFiles.length === 0 || uploading}>
                                {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Image${selectedFiles.length !== 1 ? 's' : ''}`}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Images Gallery */}
                <Card>
                    <CardHeader>
                        <CardTitle>Images ({images.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {images.length === 0 ? (
                            <div className="py-8 text-center text-gray-500">
                                <p>No images added yet. Add your first image above.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {images.map((image, index) => (
                                    <div
                                        key={image.id || `image-${index}-${image.url || 'temp'}-${index}`}
                                        className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white"
                                    >
                                        <div className="relative aspect-square w-full bg-gray-100">
                                            <Image
                                                src={image.url}
                                                alt={image.alt || 'Category image'}
                                                fill
                                                className="object-cover"
                                                unoptimized={image.url?.includes('amazonaws.com') || image.url?.includes('s3.')}
                                            />
                                            {image.isPrimary && (
                                                <div className="absolute top-2 left-2 rounded bg-[#008ECC] px-2 py-1 text-xs font-medium text-white">
                                                    Primary
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-xs text-gray-500">
                                                Order: {image.displayOrder} • {image.alt || 'No alt text'}
                                            </p>
                                            <div className="mt-2 flex gap-2">
                                                {!image.isPrimary && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSetPrimary(image.id)}
                                                        className="flex-1"
                                                    >
                                                        <Star className="mr-1 h-3 w-3" />
                                                        Set Primary
                                                    </Button>
                                                )}
                                                {image.isPrimary && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled
                                                        className="flex-1"
                                                    >
                                                        <StarOff className="mr-1 h-3 w-3" />
                                                        Primary
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDelete(image.id)}
                                                    isLoading={deleting === image.id}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            {index > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-1 w-full text-xs"
                                                    onClick={() => handleUpdateDisplayOrder(image.id, image.displayOrder - 1)}
                                                >
                                                    Move Up
                                                </Button>
                                            )}
                                            {index < images.length - 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-1 w-full text-xs"
                                                    onClick={() => handleUpdateDisplayOrder(image.id, image.displayOrder + 1)}
                                                >
                                                    Move Down
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

