"use client";

import { useState, useRef, useMemo } from "react";
import PriceDisplay from "./PriceDisplay";
import { CartItem as CartItemType, AddonRule } from "@/lib/api/cart";
import Image from "next/image";
import { FileText } from "lucide-react";
import { getPublicS3Url, isImageFile, getFilenameFromS3Key } from "@/lib/utils/s3";
import { derivePriceBreakdown, getAddonLabel, computeAddonLineTotal } from "@/lib/utils/addon-pricing";

interface CartItemProps {
    item: CartItemType;
    onQuantityChange: (id: string, quantity: number) => void;
    onRemove: (id: string) => void;
    isUpdating?: boolean;
    isRemoving?: boolean;
    isSelected?: boolean;
    onSelectChange?: (id: string, selected: boolean) => void;
    showCheckbox?: boolean;
    isCheckboxDisabled?: boolean;
    onImageUpload?: (itemId: string, files: File[]) => Promise<void>;
    isUploadingImages?: boolean;
}

export default function CartItem({
    item,
    onRemove,
    isSelected = false,
    onSelectChange,
    showCheckbox = false,
    isCheckboxDisabled = false,
    onImageUpload,
    isUploadingImages = false,
}: CartItemProps) {
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const product = item.product;
    const variant = item.variant;
    const productName = product?.name || 'Unknown Product';

    // Get uploaded files from cart item (S3 URLs already stored)
    const uploadedFileUrls = Array.isArray(item.customDesignUrl)
        ? item.customDesignUrl
        : (item.customDesignUrl ? [item.customDesignUrl] : []);

    // Check if item has images, template, or template form data
    const hasImages = useMemo(() => {
        // Check for uploaded design files
        if (item.customDesignUrl) {
            if (Array.isArray(item.customDesignUrl)) {
                if (item.customDesignUrl.length > 0 &&
                    item.customDesignUrl.some(url => url && url.trim() !== '')) {
                    return true;
                }
            } else if (typeof item.customDesignUrl === 'string' &&
                item.customDesignUrl.trim() !== '') {
                return true;
            }
        }
        // Check for template selection with form data (template form data means files not required)
        if (item.metadata?.templateId) {
            // If template has form data, consider it as having "files" (form data replaces file requirement)
            const hasFormData = item.metadata?.templateFormData && Object.keys(item.metadata.templateFormData).length > 0;
            if (hasFormData) {
            return true;
        }
            // Also check for template form images
        if (item.metadata?.templateFormImages && item.metadata.templateFormImages.length > 0) {
            return true;
            }
            // If template preview image exists, also consider it valid
            if (item.metadata?.templatePreviewImage) {
                return true;
            }
        }
        return false;
    }, [item.customDesignUrl, item.metadata]);
    
    // Check if template form data exists (for display purposes)
    const hasTemplateFormData = useMemo(() => {
        
        const hasData = !!(item.metadata?.templateId && 
                  item.metadata?.templateFormData && 
                  Object.keys(item.metadata.templateFormData).length > 0);
        return hasData;
    }, [item.metadata, item.id]);

    // Get template preview image if template is selected
    const templateId = item.metadata?.templateId;
    const templateFormImages = item.metadata?.templateFormImages || [];
    const hasTemplate = !!templateId;
    
    // Get product image with category fallback
    const productImage = useMemo(() => {
        const pickUrl = (): string => {
            // First try product images
            if (product?.images && product.images.length > 0) {
                const primaryImage = product.images.find(img => img.isPrimary);
                if (primaryImage?.url) return primaryImage.url;
                if (product.images[0]?.url) return product.images[0].url;
            }

            // Fallback to category images (category may not be in type but exists in runtime)
            const productWithCategory = product as any;
            if (productWithCategory?.category) {
                const category = productWithCategory.category;
                if (category.images && Array.isArray(category.images) && category.images.length > 0) {
                    const primaryCategoryImage = category.images.find((img: any) => img.isPrimary);
                    if (primaryCategoryImage?.url) return primaryCategoryImage.url;
                    if (category.images[0]?.url) return category.images[0].url;
                }
                if (category.image) {
                    return category.image;
                }
            }

            // Default placeholder
            return '/images/placeholder.png';
        };

        const raw = pickUrl();
        // Root-relative placeholder stays as-is; relative DB paths get prefixed;
        // full http(s) URLs pass through unchanged.
        return raw.startsWith('/') ? raw : getPublicS3Url(raw);
    }, [product]);
    
    // Determine display image: template form images > uploaded files > product image
    const displayImage = useMemo(() => {
        if (hasTemplate && templateFormImages.length > 0 && templateFormImages[0]) {
            // Show first template form image
            return getPublicS3Url(templateFormImages[0]);
        }
        if (uploadedFileUrls.length > 0 && uploadedFileUrls[0]) {
            // Show first uploaded file if it's an image
            const firstUrl = uploadedFileUrls[0];
            if (firstUrl && isImageFile(firstUrl)) {
                return getPublicS3Url(firstUrl);
            }
        }
        return productImage;
    }, [hasTemplate, templateFormImages, uploadedFileUrls, productImage]);

    // Unified price derivation (prefers server-computed pricing, falls back to
    // metadata breakdown, finally to local calc). See lib/utils/addon-pricing.
    const priceBreakdown = useMemo(() => derivePriceBreakdown(item), [item]);

    const size = variant?.name;

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Validate file types
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const invalidFiles = files.filter(f => !validTypes.includes(f.type) && !f.name.toLowerCase().endsWith('.pdf'));
        if (invalidFiles.length > 0) {
            setUploadError('Please upload only images (JPG, PNG, GIF, WEBP) or PDF files.');
            return;
        }

        // Validate file sizes (JPG/PNG/GIF/WEBP: 25MB, PDF: 75MB)
        const oversizedFiles = files.filter((f) => {
            const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
            const maxBytes = (isPdf ? 75 : 25) * 1024 * 1024;
            return f.size > maxBytes;
        });
        if (oversizedFiles.length > 0) {
            setUploadError(
                `File size limit exceeded. Images must be <= 25MB and PDFs must be <= 75MB. ${oversizedFiles.map(f => f.name).join(', ')}`
            );
            return;
        }

        setUploadError(null);

        try {
            if (onImageUpload) {
                await onImageUpload(item.id, files);
            }
        } catch (error) {
            setUploadError('Failed to upload images. Please try again.');
            console.error('Image upload error:', error);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };


    return (
        <div
            id={`cart-item-${item.id}`}
            className={`border-b border-gray-100 pb-4 sm:pb-6 flex flex-col sm:flex-row gap-4 sm:gap-6 relative bg-white ${!hasImages ? 'border-l-yellow-400' : ''
                }`}
        >
            {/* Warning badge if no images - positioned to avoid overlap with delete button */}
            {!hasImages && (
                <div className="absolute top-3 left-3 sm:left-4 bg-yellow-100 border border-yellow-300 rounded-md px-2 py-1 flex items-center gap-1 z-10">
                    <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-medium text-yellow-800">Images Required</span>
                </div>
            )}

            {/* Top row for mobile: checkbox, image, delete button */}
            <div className="flex items-start gap-3 sm:hidden">
                {/* Selection Checkbox - Mobile */}
                {showCheckbox && onSelectChange && (
                    <div className="shrink-0 pt-1">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onSelectChange(item.id, e.target.checked)}
                            disabled={isCheckboxDisabled}
                            className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isCheckboxDisabled
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                                }`}
                            aria-label={`Select ${productName}`}
                        />
                    </div>
                )}

                {/* Product Image - Mobile */}
                <div className="shrink-0">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-cover"
                            sizes="80px"
                        />
                    </div>
                </div>

                {/* Delete Button - Mobile */}
                <button
                    onClick={() => onRemove(item.id)}
                    className="ml-auto text-gray-400 hover:text-red-600 transition-colors cursor-pointer shrink-0 p-1"
                    aria-label="Remove item"
                >
                    <svg width="18" height="18" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.25 3H13.5V2.25C13.5 1.65326 13.2629 1.08097 12.841 0.65901C12.419 0.237053 11.8467 0 11.25 0H6.75C6.15326 0 5.58097 0.237053 5.15901 0.65901C4.73705 1.08097 4.5 1.65326 4.5 2.25V3H0.75C0.551088 3 0.360322 3.07902 0.21967 3.21967C0.0790178 3.36032 0 3.55109 0 3.75C0 3.94891 0.0790178 4.13968 0.21967 4.28033C0.360322 4.42098 0.551088 4.5 0.75 4.5H1.5V18C1.5 18.3978 1.65804 18.7794 1.93934 19.0607C2.22064 19.342 2.60218 19.5 3 19.5H15C15.3978 19.5 15.7794 19.342 16.0607 19.0607C16.342 18.7794 16.5 18.3978 16.5 18V4.5H17.25C17.4489 4.5 17.6397 4.42098 17.7803 4.28033C17.921 4.13968 18 3.94891 18 3.75C18 3.55109 17.921 3.36032 17.7803 3.21967C17.6397 3.07902 17.4489 3 17.25 3ZM7.5 14.25C7.5 14.4489 7.42098 14.6397 7.28033 14.7803C7.13968 14.921 6.94891 15 6.75 15C6.55109 15 6.36032 14.921 6.21967 14.7803C6.07902 14.6397 6 14.4489 6 14.25V8.25C6 8.05109 6.07902 7.86032 6.21967 7.71967C6.36032 7.57902 6.55109 7.5 6.75 7.5C6.94891 7.5 7.13968 7.57902 7.28033 7.71967C7.42098 7.86032 7.5 8.05109 7.5 8.25V14.25ZM12 14.25C12 14.4489 11.921 14.6397 11.7803 14.7803C11.6397 14.921 11.4489 15 11.25 15C11.0511 15 10.8603 14.921 10.7197 14.7803C10.579 14.6397 10.5 14.4489 10.5 14.25V8.25C10.5 8.05109 10.579 7.86032 10.7197 7.71967C10.8603 7.57902 11.0511 7.5 11.25 7.5C11.4489 7.5 11.6397 7.57902 11.7803 7.71967C11.921 7.86032 12 8.05109 12 8.25V14.25ZM12 3H6V2.25C6 2.05109 6.07902 1.86032 6.21967 1.71967C6.36032 1.57902 6.55109 1.5 6.75 1.5H11.25C11.4489 1.5 11.6397 1.57902 11.7803 1.71967C11.921 1.86032 12 2.05109 12 2.25V3Z" fill="currentColor" />
                    </svg>
                </button>
            </div>

            {/* Desktop layout: checkbox, image, content, delete */}
            <div className="hidden sm:flex sm:items-start sm:gap-6">
                {/* Selection Checkbox - Desktop */}
                {showCheckbox && onSelectChange && (
                    <div className="shrink-0 pt-3">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onSelectChange(item.id, e.target.checked)}
                            disabled={isCheckboxDisabled}
                            className={`w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isCheckboxDisabled
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                                }`}
                            aria-label={`Select ${productName}`}
                        />
                    </div>
                )}

                {/* Product Image - Desktop - Larger */}
                <div className="shrink-0">
                    <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 128px, 160px"
                        />
                    </div>
                </div>

                {/* Delete Button - Desktop */}
                <button
                    onClick={() => onRemove(item.id)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-1"
                    aria-label="Remove item"
                >
                    <svg width="20" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.25 3H13.5V2.25C13.5 1.65326 13.2629 1.08097 12.841 0.65901C12.419 0.237053 11.8467 0 11.25 0H6.75C6.15326 0 5.58097 0.237053 5.15901 0.65901C4.73705 1.08097 4.5 1.65326 4.5 2.25V3H0.75C0.551088 3 0.360322 3.07902 0.21967 3.21967C0.0790178 3.36032 0 3.55109 0 3.75C0 3.94891 0.0790178 4.13968 0.21967 4.28033C0.360322 4.42098 0.551088 4.5 0.75 4.5H1.5V18C1.5 18.3978 1.65804 18.7794 1.93934 19.0607C2.22064 19.342 2.60218 19.5 3 19.5H15C15.3978 19.5 15.7794 19.342 16.0607 19.0607C16.342 18.7794 16.5 18.3978 16.5 18V4.5H17.25C17.4489 4.5 17.6397 4.42098 17.7803 4.28033C17.921 4.13968 18 3.94891 18 3.75C18 3.55109 17.921 3.36032 17.7803 3.21967C17.6397 3.07902 17.4489 3 17.25 3ZM7.5 14.25C7.5 14.4489 7.42098 14.6397 7.28033 14.7803C7.13968 14.921 6.94891 15 6.75 15C6.55109 15 6.36032 14.921 6.21967 14.7803C6.07902 14.6397 6 14.4489 6 14.25V8.25C6 8.05109 6.07902 7.86032 6.21967 7.71967C6.36032 7.57902 6.55109 7.5 6.75 7.5C6.94891 7.5 7.13968 7.57902 7.28033 7.71967C7.42098 7.86032 7.5 8.05109 7.5 8.25V14.25ZM12 14.25C12 14.4489 11.921 14.6397 11.7803 14.7803C11.6397 14.921 11.4489 15 11.25 15C11.0511 15 10.8603 14.921 10.7197 14.7803C10.579 14.6397 10.5 14.4489 10.5 14.25V8.25C10.5 8.05109 10.579 7.86032 10.7197 7.71967C10.8603 7.57902 11.0511 7.5 11.25 7.5C11.4489 7.5 11.6397 7.57902 11.7803 7.71967C11.921 7.86032 12 8.05109 12 8.25V14.25ZM12 3H6V2.25C6 2.05109 6.07902 1.86032 6.21967 1.71967C6.36032 1.57902 6.55109 1.5 6.75 1.5H11.25C11.4489 1.5 11.6397 1.57902 11.7803 1.71967C11.921 1.86032 12 2.05109 12 2.25V3Z" fill="currentColor" />
                    </svg>
                </button>
            </div>

            {/* Product Details */}
            <div className="flex-1 flex flex-col justify-between min-w-0 pr-8 sm:pr-0">
                <div className="space-y-3 sm:space-y-4">
                    <div>
                        <h3 className="font-bold text-base sm:text-lg lg:text-xl text-gray-900 mb-2">
                            {productName}
                        </h3>
                        <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base text-gray-600">
                            {size && <span className="font-medium">Size: <span className="font-normal">{size}</span></span>}
                        </div>
                    </div>

                    {/* Template/Design Display or Upload Section */}
                    {hasImages || hasTemplateFormData ? (
                        // Show template/design preview if available
                        <div className="p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900">
                                        {hasTemplate && 'Template Selected' } 
                                    </p>
                                    {hasTemplate && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Template form completed
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {/* Show uploaded files preview if not template (only show first file as preview) */}
                            {!hasTemplate && uploadedFileUrls.length > 0 && (
                                <div className="border-gray-200">
                                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Uploaded Files ({uploadedFileUrls.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {uploadedFileUrls.slice(0, 4).map((s3Key, idx) => {
                                            const publicUrl = getPublicS3Url(s3Key);
                                            const isImage = isImageFile(s3Key);

                                            return (
                                                <div key={idx} className="relative w-12 h-12 rounded border border-gray-200 overflow-hidden bg-white">
                                                    {isImage ? (
                                                        <Image
                                                            src={publicUrl}
                                                            alt={getFilenameFromS3Key(s3Key)}
                                                            fill
                                                            className="object-cover"
                                                            sizes="48px"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                                            <FileText className="h-5 w-5 text-gray-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Show template form data if available */}
                            {hasTemplateFormData && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Form Data</p>
                                    <div className="space-y-1.5">
                                        {Object.entries(item.metadata!.templateFormData!).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-xs">
                                                <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                <span className="text-gray-900 font-medium text-right ml-2">
                                                    {typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm sm:text-base font-medium text-yellow-900">
                                    Design files required for checkout
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,.pdf"
                                onChange={handleFileSelect}
                                disabled={isUploadingImages}
                                className="hidden"
                                id={`file-input-${item.id}`}
                            />
                            <label
                                htmlFor={`file-input-${item.id}`}
                                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors cursor-pointer ${isUploadingImages
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                                    }`}
                            >
                                {isUploadingImages ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Add Images
                                    </>
                                )}
                            </label>
                            {uploadError && (
                                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
                            )}
                            <p className="mt-2 text-xs sm:text-sm text-yellow-700">
                                Upload images (max 25MB) or PDF files (max 75MB)
                            </p>
                        </div>
                    )}

                    {/* Pricing Section - Better organized and more visible */}
                    <div className="mt-4 pt-4 border-t border-gray-100">

                        {/* Main price display */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm sm:text-base text-gray-700">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-600">Base:</span>
                                    <span className="font-semibold text-gray-900">
                                        <PriceDisplay size="sm" currentPrice={priceBreakdown.baseTotal} />
                                    </span>
                                </div>
                                <span className="hidden sm:inline text-gray-400">+</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-600">Addons:</span>
                                    <span className="font-semibold text-gray-900">
                                        <PriceDisplay size="sm" currentPrice={priceBreakdown.addonTotal} />
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-xs sm:text-sm text-gray-500 mb-0.5">Total</div>
                                <div className="flex items-center gap-2 text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                                    <PriceDisplay size="lg" currentPrice={priceBreakdown.total} />
                                </div>
                            </div>
                        </div>

                        {/* Per-addon summary so the user can see what they picked */}
                        {item.addons && item.addons.length > 0 && (
                            <ul className="mt-2 pl-3 border-l-2 border-purple-200 space-y-0.5">
                                {(item.addons as AddonRule[]).map((addon, idx) => (
                                    <li key={addon.id} className="text-xs text-purple-700">
                                        {getAddonLabel(addon, idx)}: ₹{computeAddonLineTotal(addon, { quantity: item.quantity, metadata: item.metadata, fileCount: uploadedFileUrls.length }).toFixed(2)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* <QuantitySelector
                            quantity={item.quantity}
                            onQuantityChange={(newQuantity) => onQuantityChange(item.id, newQuantity)}
                        /> */}
            </div>
        </div>
    );
}
