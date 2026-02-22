"use client";

import Link from "next/link";
import { useState, useRef, useMemo } from "react";
import PriceDisplay from "./PriceDisplay";
import { CartItem as CartItemType, AddonRule } from "@/lib/api/cart";
import Image from "next/image";
import { FileText } from "lucide-react";
import { getPublicS3Url, isImageFile, getFilenameFromS3Key } from "@/lib/utils/s3";

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
    console.log("---------more about the items", item)

    // Get uploaded files from cart item (S3 URLs already stored)
    const uploadedFileUrls = Array.isArray(item.customDesignUrl)
        ? item.customDesignUrl
        : (item.customDesignUrl ? [item.customDesignUrl] : []);

    // Check if item has images
    const hasImages = useMemo(() => {
        if (!item.customDesignUrl) return false;
        if (Array.isArray(item.customDesignUrl)) {
            return item.customDesignUrl.length > 0 &&
                item.customDesignUrl.some(url => url && url.trim() !== '');
        }
        return typeof item.customDesignUrl === 'string' &&
            item.customDesignUrl.trim() !== '';
    }, [item.customDesignUrl]);

    // Get product image
    const productImage = product?.images?.find(img => img.isPrimary)?.url ||
        product?.images?.[0]?.url ||
        '/images/placeholder.png';

    // Calculate price
    const basePrice = Number(product?.sellingPrice || product?.basePrice || 0);
    const variantModifier = Number(variant?.priceModifier || 0);
    const itemPrice = basePrice + variantModifier;

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

        // Validate file sizes (max 50MB per file)
        const maxSize = 50 * 1024 * 1024; // 50MB
        const oversizedFiles = files.filter(f => f.size > maxSize);
        if (oversizedFiles.length > 0) {
            setUploadError(`File size must be less than 50MB. ${oversizedFiles.map(f => f.name).join(', ')}`);
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
                <div className="absolute top-3 left-3 sm:left-4 bg-yellow-100 border border-yellow-300 rounded-md px-2 py-1 flex items-center gap-1 z-10 shadow-sm">
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
                <Link href={`/products/${item.productId}`} className="shrink-0">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-cover"
                            unoptimized={productImage.includes('amazonaws.com') || productImage.includes('s3.')}
                            sizes="80px"
                        />
                    </div>
                </Link>

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
                <Link href={`/products/${item.productId}`} className="shrink-0">
                    <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <Image
                            src={productImage}
                            alt={productName}
                            fill
                            className="object-cover"
                            unoptimized={productImage.includes('amazonaws.com') || productImage.includes('s3.')}
                            sizes="(max-width: 1024px) 128px, 160px"
                        />
                    </div>
                </Link>

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
                        <Link href={`/products/${item.productId}`}>
                            <h3 className="font-bold text-base sm:text-lg lg:text-xl text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                                {productName}
                            </h3>
                        </Link>
                        <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base text-gray-600">
                            {size && <span className="font-medium">Size: <span className="font-normal">{size}</span></span>}
                        </div>
                    </div>

                    {/* Uploaded Files Section - Show if files are uploaded (S3 URLs stored in cart) */}
                    {uploadedFileUrls.length > 0 && (
                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Uploaded Files ({uploadedFileUrls.length})
                            </div>
                            <div className="flex flex-wrap gap-2 sm:gap-3">
                                {uploadedFileUrls.slice(0, 4).map((s3Key, idx) => {
                                    const publicUrl = getPublicS3Url(s3Key);
                                    const isImage = isImageFile(s3Key);

                                    return (
                                        <div key={idx} className="relative w-12 h-12 sm:w-14 sm:h-14 rounded border border-blue-200 overflow-hidden bg-white shadow-sm">
                                            {isImage ? (
                                                <Image
                                                    src={publicUrl}
                                                    alt={getFilenameFromS3Key(s3Key)}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized={publicUrl.includes('amazonaws.com') || publicUrl.includes('s3.')}
                                                    sizes="(max-width: 640px) 48px, 56px"
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


                    {/* Image Upload Section - Show if no images */}
                    {!hasImages && (
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
                                Upload images or PDF files (max 50MB per file)
                            </p>
                        </div>
                    )}

                    {/* Pricing Section - Better organized and more visible */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        {/* Show addons with names and prices if available */}
                        {item.metadata?.priceBreakdown && item.metadata.priceBreakdown.length > 0 && (
                            <div className="mb-3 space-y-1">
                                {item.metadata.priceBreakdown.map((breakdown, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm text-gray-600">
                                        <span>+ {breakdown.label}</span>
                                        <span className="font-medium">
                                            <PriceDisplay currentPrice={breakdown.value} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Main price display */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm sm:text-base text-gray-700">
                                {/* Base price */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-600">Base:</span>
                                    <span className="font-semibold text-gray-900">
                                        <PriceDisplay
                                            size="sm"
                                            currentPrice={
                                                (() => {
                                                    // Prefer backend pricing breakdown if available
                                                    if ((item as any).pricing) {
                                                        return Number((item as any).pricing.baseTotal || 0);
                                                    }
                                                    // Fallback: use metadata priceBreakdown
                                                    if (item.metadata?.priceBreakdown && Array.isArray(item.metadata.priceBreakdown)) {
                                                        const base = item.metadata.priceBreakdown.find(x => x.label === "Base");
                                                        return base ? base.value : 0;
                                                    }
                                                    // Fallback: get from product/variant
                                                    if (item.product) {
                                                        const price = Number(item.product?.sellingPrice || item.product?.basePrice || 0);
                                                        const variantModifier = Number(item.variant?.priceModifier || 0);
                                                        return (price + variantModifier);
                                                    }
                                                    return 0;
                                                })()
                                            }
                                        />
                                    </span>
                                </div>
                                <span className="hidden sm:inline text-gray-400">+</span>
                                {/* Addon price list or "Addons" summary */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-600">Addons:</span>
                                    <span className="font-semibold text-gray-900">
                                        <PriceDisplay
                                            size="sm"
                                            currentPrice={
                                                (() => {
                                                    // Prefer backend pricing breakdown if available
                                                    if ((item as any).pricing) {
                                                        return Number((item as any).pricing.addonTotal || 0);
                                                    }
                                                    // Fallback: metadata priceBreakdown
                                                    if (item.metadata?.priceBreakdown && Array.isArray(item.metadata.priceBreakdown)) {
                                                        // sum all except the "Base"
                                                        return item.metadata.priceBreakdown
                                                            .filter(x => x.label !== "Base" && typeof x.value === "number")
                                                            .reduce((acc, x) => acc + (x.value || 0), 0);
                                                    }
                                                    // Fallback: sum AddonRule[]
                                                    if (item.addons && item.addons.length > 0) {
                                                        return (item.addons as AddonRule[]).reduce((sum, addon) => {
                                                            const price =
                                                                (addon.priceModifier ?? undefined) !== undefined
                                                                    ? Number(addon.priceModifier)
                                                                    : (addon.basePrice ?? undefined) !== undefined
                                                                        ? Number(addon.basePrice)
                                                                        : 0;
                                                            return sum + price;
                                                        }, 0);
                                                    }
                                                    return 0;
                                                })()
                                            }
                                        />
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-xs sm:text-sm text-gray-500 mb-0.5">Total</div>
                                <div className="flex items-center gap-2 text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                                    <PriceDisplay
                                        size="lg"
                                        currentPrice={
                                            (() => {
                                                // Prefer backend pricing breakdown if available
                                                if ((item as any).pricing) {
                                                    return Number((item as any).pricing.total || 0);
                                                }
                                                // Fallback: use metadata priceBreakdown
                                                let total = 0;
                                                if (item.metadata?.priceBreakdown && Array.isArray(item.metadata.priceBreakdown)) {
                                                    total = item.metadata.priceBreakdown.reduce(
                                                        (acc, x) => acc + (x.value || 0),
                                                        0
                                                    );
                                                } else if (item.addons && item.addons.length > 0) {
                                                    let base = 0;
                                                    if (item.product) {
                                                        const price = Number(item.product?.sellingPrice || item.product?.basePrice || 0);
                                                        const variantModifier = Number(item.variant?.priceModifier || 0);
                                                        base = price + variantModifier;
                                                    }
                                                    const addonTotal = (item.addons as AddonRule[]).reduce((sum, addon) => {
                                                        const price =
                                                            (addon.priceModifier ?? undefined) !== undefined
                                                                ? Number(addon.priceModifier)
                                                                : (addon.basePrice ?? undefined) !== undefined
                                                                    ? Number(addon.basePrice)
                                                                    : 0;
                                                        return sum + price;
                                                    }, 0);
                                                    total = base + addonTotal;
                                                }
                                                return total;
                                            })()
                                        }
                                    />
                                </div>
                            </div>
                        </div>
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
