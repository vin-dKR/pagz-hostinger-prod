"use client";

import { useState, useRef, useMemo } from "react";
import PriceDisplay from "./PriceDisplay";
import { CartItem as CartItemType, AddonRule } from "@/lib/api/cart";
import Image from "next/image";
import { getPublicS3Url, isImageFile, getFilenameFromS3Key } from "@/lib/utils/s3";
import { derivePriceBreakdown, getAddonLabel, computeAddonLineTotal } from "@/lib/utils/addon-pricing";
import { UploadedFileTile } from "./UploadedFileTile";
import { validateFiles } from "@/lib/utils/file-validation";

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

    // Handle file selection. Uses the shared `validateFiles` util so cart
    // mirrors the service-page upload rules (JPG / PNG / PDF only — no
    // GIF/WEBP/audio/video). The browser-level `accept` attribute hides
    // most non-matching files in the OS dialog, but users can override
    // that with an "All files" filter, so we re-check here.
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const validation = validateFiles(files);
        if (!validation.valid) {
            const names = validation.invalidFiles.map((f) => f.file.name).join(', ');
            setUploadError(`Only JPG, PNG, and PDF files are allowed. Rejected: ${names}`);
            // Clear input so the user can re-pick after fixing.
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Size caps: image ≤ 25 MB, PDF ≤ 75 MB. Reject the whole batch
        // on first violation so the user knows nothing was uploaded.
        const oversizedFiles = files.filter((f) => {
            const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
            const maxBytes = (isPdf ? 75 : 25) * 1024 * 1024;
            return f.size > maxBytes;
        });
        if (oversizedFiles.length > 0) {
            setUploadError(
                `File size limit exceeded. Images must be ≤ 25 MB and PDFs ≤ 75 MB. ${oversizedFiles.map((f) => f.name).join(', ')}`
            );
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploadError(null);

        try {
            if (onImageUpload) {
                await onImageUpload(item.id, files);
            }
        } catch (error) {
            setUploadError('Failed to upload files. Please try again.');
            console.error('File upload error:', error);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };


    // Compact metadata line shown under the title:
    //   "1 copy · 482 pages · 241 effective (Both Sides)"
    // Inlining the half-page delta keeps the user informed without the
    // banner-sized block that was eating ~80px of vertical space.
    const copies = item.metadata?.copies;
    const pageCount = item.metadata?.pageCount;
    const effectivePageCount = item.metadata?.effectivePageCount;
    const hasHalfPage = !!item.metadata?.hasHalfPageAdjustment;

    const metaParts: string[] = [];
    if (copies) metaParts.push(`${copies} ${copies === 1 ? "copy" : "copies"}`);
    if (pageCount) metaParts.push(`${pageCount} page${pageCount === 1 ? "" : "s"}`);
    const metaLine = metaParts.join(" · ");
    const halfPageNote =
        hasHalfPage && effectivePageCount && pageCount && effectivePageCount !== pageCount
            ? `${effectivePageCount} effective (Both Sides)`
            : null;

    return (
        <div
            id={`cart-item-${item.id}`}
            className={`relative bg-white rounded-lg border border-gray-200 p-3 sm:p-4 ${!hasImages ? "border-l-4 border-l-yellow-400" : ""}`}
        >
            <div className="flex gap-3 sm:gap-4">
                {/* Selection checkbox */}
                {showCheckbox && onSelectChange && (
                    <div className="shrink-0 pt-1">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onSelectChange(item.id, e.target.checked)}
                            disabled={isCheckboxDisabled}
                            className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                                isCheckboxDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                            }`}
                            aria-label={`Select ${productName}`}
                        />
                    </div>
                )}

                {/* Product image — single size across breakpoints, was 128–160px wasting space. */}
                <div className="shrink-0">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                        <Image
                            src={displayImage}
                            alt={productName}
                            fill
                            className="object-cover"
                            sizes="96px"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                    {/* Title row + delete */}
                    <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 leading-snug truncate">
                                {productName}
                            </h3>
                            {(metaLine || halfPageNote || size) && (
                                <p className="mt-0.5 text-xs text-gray-500 truncate">
                                    {[metaLine, size && `Size: ${size}`].filter(Boolean).join(" · ")}
                                    {halfPageNote && (
                                        <>
                                            {metaLine || size ? " · " : ""}
                                            <span className="text-blue-600">{halfPageNote}</span>
                                        </>
                                    )}
                                </p>
                            )}
                        </div>
                        {!hasImages && (
                            <span className="shrink-0 inline-flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Files required
                            </span>
                        )}
                        <button
                            onClick={() => onRemove(item.id)}
                            className="shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1 -m-1 rounded"
                            aria-label="Remove item"
                            type="button"
                        >
                            <svg width="16" height="16" viewBox="0 0 18 20" fill="none">
                                <path d="M17.25 3H13.5V2.25C13.5 1.65326 13.2629 1.08097 12.841 0.65901C12.419 0.237053 11.8467 0 11.25 0H6.75C6.15326 0 5.58097 0.237053 5.15901 0.65901C4.73705 1.08097 4.5 1.65326 4.5 2.25V3H0.75C0.551088 3 0.360322 3.07902 0.21967 3.21967C0.0790178 3.36032 0 3.55109 0 3.75C0 3.94891 0.0790178 4.13968 0.21967 4.28033C0.360322 4.42098 0.551088 4.5 0.75 4.5H1.5V18C1.5 18.3978 1.65804 18.7794 1.93934 19.0607C2.22064 19.342 2.60218 19.5 3 19.5H15C15.3978 19.5 15.7794 19.342 16.0607 19.0607C16.342 18.7794 16.5 18.3978 16.5 18V4.5H17.25C17.4489 4.5 17.6397 4.42098 17.7803 4.28033C17.921 4.13968 18 3.94891 18 3.75C18 3.55109 17.921 3.36032 17.7803 3.21967C17.6397 3.07902 17.4489 3 17.25 3Z" fill="currentColor" />
                            </svg>
                        </button>
                    </div>

                    {/* Hidden file input — kept outside the empty-vs-populated
                        branches so the same input drives both the initial
                        "Add files" button and the "Add more" button. The
                        accept list is restricted to image/jpeg, image/png,
                        and application/pdf only — the browser hides
                        non-matching files in the OS picker by default,
                        which is the user-visible part of "no mp3/mp4". */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                        onChange={handleFileSelect}
                        disabled={isUploadingImages}
                        className="hidden"
                        id={`file-input-${item.id}`}
                    />

                    {/* Files / template / upload prompt */}
                    {hasImages || hasTemplateFormData ? (
                        <div className="mt-3 space-y-2">
                            {hasTemplate && (
                                <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                                    <span className="font-medium">Template:</span>
                                    <span className="text-gray-500">selected · form completed</span>
                                </div>
                            )}

                            {!hasTemplate && uploadedFileUrls.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5 gap-2">
                                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                            Uploaded files ({uploadedFileUrls.length})
                                        </p>
                                        <label
                                            htmlFor={`file-input-${item.id}`}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                                                isUploadingImages
                                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                    : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                                            }`}
                                        >
                                            {isUploadingImages ? (
                                                <>
                                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Uploading…
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    Add more
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {uploadedFileUrls.slice(0, 6).map((s3Key, idx) => (
                                            <UploadedFileTile
                                                key={idx}
                                                name={getFilenameFromS3Key(s3Key)}
                                                url={getPublicS3Url(s3Key)}
                                            />
                                        ))}
                                    </div>
                                    {uploadedFileUrls.length > 6 && (
                                        <p className="mt-1 text-[11px] text-gray-500">
                                            +{uploadedFileUrls.length - 6} more file{uploadedFileUrls.length - 6 === 1 ? "" : "s"}
                                        </p>
                                    )}
                                    {uploadError && (
                                        <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
                                    )}
                                </div>
                            )}

                            {hasTemplateFormData && (
                                <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                                    <p className="text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Form data</p>
                                    <div className="space-y-0.5">
                                        {Object.entries(item.metadata!.templateFormData!).map(([key, value]) => (
                                            <div key={key} className="flex justify-between gap-2 text-xs">
                                                <span className="text-gray-500 capitalize truncate">
                                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                                </span>
                                                <span className="text-gray-800 font-medium truncate text-right">
                                                    {typeof value === "string" || typeof value === "number"
                                                        ? String(value)
                                                        : JSON.stringify(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-xs sm:text-sm font-medium text-yellow-900">
                                    Design files required
                                </p>
                                <label
                                    htmlFor={`file-input-${item.id}`}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                                        isUploadingImages
                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                            : "bg-yellow-500 text-white hover:bg-yellow-600"
                                    }`}
                                >
                                    {isUploadingImages ? (
                                        <>
                                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Uploading…
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            Add files
                                        </>
                                    )}
                                </label>
                            </div>
                            {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
                            <p className="mt-1 text-[11px] text-yellow-700">
                                JPG / PNG ≤ 25 MB · PDF ≤ 75 MB · multiple files supported
                            </p>
                        </div>
                    )}

                    {/* Price row */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-end justify-between gap-3">
                        <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 min-w-0">
                            <span>
                                Base{" "}
                                <span className="font-medium text-gray-900">
                                    <PriceDisplay size="sm" currentPrice={priceBreakdown.baseTotal} />
                                </span>
                            </span>
                            {priceBreakdown.addonTotal > 0 && (
                                <span>
                                    Addons{" "}
                                    <span className="font-medium text-gray-900">
                                        <PriceDisplay size="sm" currentPrice={priceBreakdown.addonTotal} />
                                    </span>
                                </span>
                            )}
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400">Total</div>
                            <div className="text-base sm:text-lg font-bold text-blue-600 leading-none">
                                <PriceDisplay size="lg" currentPrice={priceBreakdown.total} />
                            </div>
                        </div>
                    </div>

                    {/* Per-addon list — single tight row when addons exist */}
                    {item.addons && item.addons.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            {(item.addons as AddonRule[]).map((addon, idx) => (
                                <li key={addon.id} className="text-[11px] text-gray-500">
                                    <span className="text-gray-600">{getAddonLabel(addon, idx)}</span>{" "}
                                    <span className="font-medium text-gray-700">
                                        ₹{computeAddonLineTotal(addon, { quantity: item.quantity, metadata: item.metadata, fileCount: uploadedFileUrls.length }).toFixed(2)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
