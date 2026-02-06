'use client';

/**
 * Product Image Upload Component
 * Supports both file upload (S3) and URL input
 */

import { useState, useRef, FormEvent } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadProductImageApi, uploadProductImagesApi, deleteProductImageApi, type ProductImage } from '@/lib/api/products.service';
import Image from 'next/image';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastPromise } from '@/lib/utils/toast';

interface ImageUploadProps {
    productId: string;
    images: ProductImage[];
    onImagesChange: (images: ProductImage[]) => void;
}

export function ProductImageUpload({ productId, images, onImagesChange }: ImageUploadProps) {
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [imageUrl, setImageUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { confirm, ConfirmDialog } = useConfirm();

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

        setSelectedFiles(files);
        setError(null);
    };

    const handleFileUpload = async (e: FormEvent) => {
        e.preventDefault();
        if (selectedFiles.length === 0) {
            setError('Please select at least one file');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            if (selectedFiles.length === 1) {
                // Single file upload
                const file = selectedFiles[0];
                if (file) {
                    const newImage = await uploadProductImageApi(productId, file, {
                        isPrimary: images.length === 0, // First image is primary
                    });
                    onImagesChange([...images, newImage]);
                }
            } else {
                // Multiple files upload
                const newImages = await uploadProductImagesApi(productId, selectedFiles);
                onImagesChange([...images, ...newImages]);
            }

            setSelectedFiles([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload images');
        } finally {
            setUploading(false);
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
                    await toastPromise(
                        deleteProductImageApi(imageId),
                        {
                            loading: 'Deleting image...',
                            success: 'Image deleted successfully',
                            error: 'Failed to delete image',
                        }
                    );
                    onImagesChange(images.filter(img => img.id !== imageId));
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete image');
                }
            },
        });
    };

    const handleSetPrimary = async (imageId: string) => {
        // This would need to be implemented via API
        // For now, we'll just update the local state
        const updatedImages = images.map(img => ({
            ...img,
            isPrimary: img.id === imageId,
        }));
        onImagesChange(updatedImages);
    };

    return (
        <div className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            {/* Upload Mode Toggle */}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant={uploadMode === 'file' ? 'default' : 'outline'}
                    onClick={() => setUploadMode('file')}
                    size="sm"
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                </Button>
                <Button
                    type="button"
                    variant={uploadMode === 'url' ? 'default' : 'outline'}
                    onClick={() => setUploadMode('url')}
                    size="sm"
                >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Enter URL
                </Button>
            </div>

            {/* File Upload Form */}
            {uploadMode === 'file' && (
                <form onSubmit={handleFileUpload} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="image-files">Select Images</Label>
                        <Input
                            id="image-files"
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                            multiple
                            onChange={handleFileSelect}
                        />
                        {selectedFiles.length > 0 && (
                            <div className="mt-2 space-y-1 rounded-md border p-2">
                                {selectedFiles.map((file, index) => (
                                    <p key={index} className="text-sm text-gray-600">
                                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                    </p>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-gray-500">
                            Supported formats: JPG, PNG, WebP, GIF. Max size: 10MB per image
                        </p>
                    </div>
                    <Button type="submit" isLoading={uploading} disabled={selectedFiles.length === 0 || uploading}>
                        {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Image${selectedFiles.length !== 1 ? 's' : ''}`}
                    </Button>
                </form>
            )}

            {/* URL Input Form */}
            {uploadMode === 'url' && (
                <div className="space-y-2">
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                        id="image-url"
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                        Enter the full URL of the image. This will be added when you save the product.
                    </p>
                </div>
            )}

            {/* Image Gallery */}
            {images.length > 0 && (
                <div className="space-y-2">
                    <Label>Uploaded Images ({images.length})</Label>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {images.map((image) => (
                            <div key={image.id} className="relative group">
                                <div className="relative aspect-square overflow-hidden rounded-md border">
                                    <Image
                                        src={image.url}
                                        alt={image.alt || 'Product image'}
                                        fill
                                        className="object-cover"
                                        unoptimized={image.url?.includes('amazonaws.com') || image.url?.includes('s3.')}
                                    />
                                    {image.isPrimary && (
                                        <div className="absolute top-2 left-2 rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white">
                                            Primary
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleSetPrimary(image.id)}
                                            disabled={image.isPrimary}
                                        >
                                            Set Primary
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDelete(image.id)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="mt-1 truncate text-xs text-gray-500">{image.alt || 'No alt text'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

