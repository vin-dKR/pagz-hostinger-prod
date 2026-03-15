'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { getPublicS3Url } from '@/lib/utils/s3';
import { getCategoryTemplates, type CategoryTemplate } from '@/lib/api/templates';
import { getProduct } from '@/lib/api/products';

interface TemplateDataDisplayProps {
    templateId?: string;
    templateName?: string;
    templatePreviewImage?: string;
    formData?: Record<string, any>;
    formImages?: string[];
    categorySlug?: string; // Optional: category slug to fetch template if image is missing
    productId?: string; // Optional: product ID to get category info
}

export function TemplateDataDisplay({
    templateId,
    templateName,
    templatePreviewImage,
    formData,
    formImages,
    categorySlug,
    productId,
}: TemplateDataDisplayProps) {
    const [fetchedTemplate, setFetchedTemplate] = useState<CategoryTemplate | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);

    // Fetch template if image is missing and we have templateId
    useEffect(() => {
        if (templateId && !templatePreviewImage) {
            fetchTemplate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId, templatePreviewImage]);

    const fetchTemplate = async () => {
        if (!templateId) return;
        
        try {
            setLoadingTemplate(true);
            setTemplateError(null);
            
            let slugToUse = categorySlug;
            
            // If no categorySlug provided, try to get it from product
            if (!slugToUse && productId) {
                try {
                    const productResponse = await getProduct(productId);
                    if (productResponse.success && productResponse.data?.category?.slug) {
                        slugToUse = productResponse.data.category.slug;
                    }
                } catch (productError) {
                    console.error('Failed to fetch product for category:', productError);
                }
            }
            
            if (!slugToUse) {
                setTemplateError('Category information not available');
                return;
            }
            
            const templates = await getCategoryTemplates(slugToUse);
            const template = templates.find(t => t.id === templateId);
            if (template) {
                setFetchedTemplate(template);
            } else {
                setTemplateError('Template not found');
            }
        } catch (error) {
            console.error('Failed to fetch template:', error);
            setTemplateError(error instanceof Error ? error.message : 'Failed to fetch template');
        } finally {
            setLoadingTemplate(false);
        }
    };

    if (!templateId && !templateName) {
        return null;
    }

    // Use fetched template data if available
    const displayTemplateName = templateName || fetchedTemplate?.name;
    const displayTemplateImage = templatePreviewImage || fetchedTemplate?.previewImageUrl;

    return (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="font-medium text-blue-900">Template Information</h4>
            </div>

            {/* Template Name - Show first, even if no image */}
            {templateName && (
                <p className="text-sm font-medium text-gray-900 mb-3">
                    <span className="text-gray-600">Template:</span>{' '}
                    <span className="text-gray-900 font-semibold">{templateName}</span>
                </p>
            )}

            {/* Template ID if name is not available */}
            {!templateName && templateId && (
                <p className="text-sm font-medium text-gray-900 mb-3">
                    <span className="text-gray-600">Template ID:</span>{' '}
                    <span className="text-gray-900 font-mono text-xs">{templateId}</span>
                </p>
            )}

            {/* Template Preview Image */}
            {templatePreviewImage ? (
                <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                        Template Preview
                    </p>
                    <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        {displayTemplateImage && (
                            <img
                                src={getPublicS3Url(displayTemplateImage)}
                                alt={displayTemplateName || 'Template preview'}
                                className="w-full h-48 sm:h-64 object-contain rounded"
                                onError={(e) => {
                                    // Fallback if image fails to load
                                    console.error('Failed to load template image:', displayTemplateImage);
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        )}
                    </div>
                </div>
            ) : !loadingTemplate && (
                <p className="text-xs text-gray-500 mb-3 italic">Template preview image not available</p>
            )}

            {formData && Object.keys(formData).length > 0 && (
                <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                        Form Data
                    </p>
                    <div className="space-y-1.5">
                        {Object.entries(formData).map(([key, value]) => {
                            if (value === null || value === undefined || value === '') {
                                return null;
                            }
                            return (
                                <div key={key} className="text-sm">
                                    <span className="font-medium text-gray-700">{key}:</span>{' '}
                                    <span className="text-gray-600">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {formImages && Array.isArray(formImages) && formImages.length > 0 && (
                <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                            Uploaded Images ({formImages.length})
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {formImages.filter((url): url is string => typeof url === 'string' && url.trim() !== '').map((imageUrl, index) => (
                            <div key={index} className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                                <img
                                    src={getPublicS3Url(imageUrl)}
                                    alt={`Form image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.error('Failed to load form image:', imageUrl);
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
