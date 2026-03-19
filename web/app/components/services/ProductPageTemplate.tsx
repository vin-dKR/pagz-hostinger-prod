'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProductGallery } from './ProductGallery';
import { ProductFeatures } from './ProductFeatures';
import { PriceBreakdown } from './print/PriceBreakdown';
import { Button } from './print/Button';
import { AlertCircle, Info, ShoppingCart } from 'lucide-react';
import { ProductData, BreadcrumbItem } from '@/types';
import Breadcrumbs from '../Breadcrumbs';
import { useRouter } from 'next/navigation';
import ProductDocumentUpload, { FileDetail } from '../products/ProductDocumentUpload';
import { toastError } from '@/lib/utils/toast';

function MultiplePasswordsEditor({
    filePassword,
    onFilePasswordChange,
    onPasswordSubmittedChange,
}: {
    filePassword: string;
    onFilePasswordChange?: (value: string) => void;
    onPasswordSubmittedChange?: (value: boolean) => void;
}) {
    const initial = useMemo(
        () =>
            (filePassword || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean),
        [filePassword]
    );
    const [passwords, setPasswords] = useState<string[]>(initial.length > 0 ? initial : ['']);

    useEffect(() => {
        const parsed = (filePassword || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        setPasswords(parsed.length > 0 ? parsed : ['']);
    }, [filePassword]);

    const updateParent = (vals: string[]) => {
        const joined = vals
            .map(v => v.trim())
            .filter(Boolean)
            .join(', ');
        onFilePasswordChange?.(joined);
    };

    const setAt = (idx: number, value: string) => {
        setPasswords(prev => {
            const next = [...prev];
            next[idx] = value;
            updateParent(next);
            return next;
        });
    };

    const addField = () => {
        setPasswords(prev => {
            const next = [...prev, ''];
            return next;
        });
    };

    const removeField = (idx: number) => {
        setPasswords(prev => {
            const next = prev.filter((_, i) => i !== idx);
            updateParent(next);
            return next.length > 0 ? next : [''];
        });
    };

    const canSubmit = passwords.some(p => p.trim().length > 0);

    return (
        <>
            <label className="block text-xs font-medium text-gray-600 mb-1">
                Enter password(s) (shared with admin)
            </label>
            <div className="space-y-2">
                {passwords.map((pwd, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <input
                            type="text"
                            value={pwd}
                            onChange={(e) => setAt(idx, e.target.value)}
                            placeholder="e.g. 1234"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        {passwords.length > 1 && (
                            <Button
                                onClick={() => removeField(idx)}
                                variant="outline"
                                className="px-4 py-2"
                            >
                                −
                            </Button>
                        )}
                        {idx === passwords.length - 1 && (
                            <Button
                                onClick={addField}
                                variant="outline"
                                className="px-4 py-2"
                            >
                                +
                            </Button>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
                <Button
                    onClick={() => {
                        if (canSubmit) {
                            onPasswordSubmittedChange?.(true);
                        }
                    }}
                    disabled={!canSubmit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Submit
                </Button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
                Only enter this if your PDF/document is password protected. You can add multiple passwords.
            </p>
        </>
    );
}

interface ProductPageTemplateProps {
    productData: Partial<ProductData>;
    breadcrumbItems: BreadcrumbItem[];
    uploadedFile: File | null;
    onFileSelect: (file: File | null) => void;
    onFileRemove: () => void;
    onFileSelectWithQuantity?: (files: File[], pageCount: number, fileDetails?: FileDetail[]) => void;
    onQuantityChange?: (quantity: number) => void;
    priceItems: Array<{ label: string; value: number; description?: string }>;
    totalPrice: number;
    basePricePerUnit?: number; // Base price per page/unit for detailed breakdown
    onAddToCart: () => void;
    onBuyNow: () => void;
    addToCartLoading?: boolean;
    buyNowLoading?: boolean;
    isInCart?: boolean;
    children: React.ReactNode;
    stock?: number | null;
    isOutOfStock?: boolean;
    productId?: string | null;
    images?: Array<{ id: string; src: string; alt: string; thumbnailSrc?: string }>;
    minQuantity?: number;
    areRequiredFieldsFilled?: boolean;
    pageCount?: number; // For price breakdown display (effective page count if half-page applied)
    originalPageCount?: number; // Original page count before half-page adjustment
    hasHalfPageAdjustment?: boolean; // Whether half-page adjustment was applied
    copies?: number; // For price breakdown display
    quantity?: number; // For price breakdown display
    hasUploadedFiles?: boolean; // Whether files have been uploaded or template selected
    hasTemplates?: boolean; // Whether category has templates
    calculatingPrice?: boolean; // Whether price is being calculated
    isUploadingFiles?: boolean; // Whether files are currently uploading
    uploadedFilesS3: FileDetail[]
    setUploadedFilesS3: React.Dispatch<React.SetStateAction<FileDetail[]>>
    hideFileUpload?: boolean;
    templateSelector?: React.ReactNode; // Template selector component to show when templates exist
    fileHasPassword?: boolean;
    filePassword?: string;
    isPasswordSubmitted?: boolean;
    onFileHasPasswordChange?: (value: boolean) => void;
    onFilePasswordChange?: (value: string) => void;
    onPasswordSubmittedChange?: (value: boolean) => void;
}

export const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
    productData,
    breadcrumbItems,
    uploadedFile,
    onFileSelect,
    onFileRemove,
    onFileSelectWithQuantity,
    onQuantityChange,
    priceItems,
    totalPrice,
    basePricePerUnit,
    onAddToCart,
    onBuyNow,
    addToCartLoading = false,
    buyNowLoading = false,
    isInCart = false,
    children,
    stock,
    isOutOfStock = false,
    productId,
    images = [],
    minQuantity = 1,
    areRequiredFieldsFilled = false,
    pageCount,
    originalPageCount,
    hasHalfPageAdjustment = false,
    copies,
    quantity,
    hasUploadedFiles = false,
    hasTemplates = false,
    calculatingPrice = false,
    isUploadingFiles = false,
    uploadedFilesS3,
    setUploadedFilesS3,
    hideFileUpload = false,
    templateSelector,
    fileHasPassword = false,
    filePassword = '',
    isPasswordSubmitted = false,
    onFileHasPasswordChange,
    onFilePasswordChange,
    onPasswordSubmittedChange,
}) => {
    const router = useRouter();
    const outOfStock = isOutOfStock || (stock !== null && stock !== undefined && stock <= 0);
    const prevOutOfStockRef = useRef<boolean | null>(null);
    const hasUploadedFilesNow = (uploadedFilesS3 && uploadedFilesS3.length > 0) || false;

    // Show toast error when product becomes out of stock after combination change
    useEffect(() => {
        // Only show toast if:
        // 1. Product is now out of stock
        // 2. It wasn't out of stock before (or this is the first check after a combination change)
        // 3. We have a productId (meaning we're tracking stock)
        if (outOfStock && prevOutOfStockRef.current === false && productId) {
            toastError('This product is out of stock. Please select a different combination or contact us.');
        }
        // Update the previous value
        prevOutOfStockRef.current = outOfStock;
    }, [outOfStock, productId]);

    // When all uploaded files are removed, disable and reset password-related state
    useEffect(() => {
        if (!hasUploadedFilesNow) {
            if (fileHasPassword) {
                onFileHasPasswordChange?.(false);
            }
            if (filePassword) {
                onFilePasswordChange?.('');
            }
            if (isPasswordSubmitted) {
                onPasswordSubmittedChange?.(false);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasUploadedFilesNow]);

    // Determine validation message (show once below buttons)
    const actionMessageInfo = (() => {
        if (outOfStock) {
            return {
                type: 'error' as const,
                title: 'Out of stock',
                message: 'This product is currently unavailable. Please change the options or contact us.',
            };
        }
        if (!hasUploadedFiles) {
            return {
                type: 'info' as const,
                title: 'Upload required',
                message: hasTemplates
                    ? 'Upload your file(s) or select a template to continue.'
                    : 'Upload your file(s) to continue.',
            };
        }
        if (!areRequiredFieldsFilled) {
            return {
                type: 'warning' as const,
                title: 'Missing required selection',
                message: 'Please select all mandatory fields in “Customize Your Order”.',
            };
        }
        return null;
    })();

    // Disable actions when a message is shown (and during async work)
    const disableBecauseMessage = !!actionMessageInfo;
    const disableAddToCart =
        isUploadingFiles ||
        addToCartLoading ||
        calculatingPrice ||
        (disableBecauseMessage && !isInCart); // allow "Go to Cart" even if message is present
    const disableBuyNow =
        isUploadingFiles || buyNowLoading || calculatingPrice || disableBecauseMessage;

    const addToCartLabel = isInCart ? 'Go to Cart' : `Add to Cart - ₹${totalPrice.toFixed(2)}`;
    const buyNowLabel = 'Buy Now';

    // Transform breadcrumb items to match Breadcrumbs component format
    const breadcrumbsFormatted = breadcrumbItems.map(item => ({
        label: item.label,
        href: item.href,
        isActive: item.isActive
    }));
    
    return (
        <div className="min-h-screen bg-white py-8 pb-24">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumbs - Hidden on mobile, shown on tablet and above */}
                <div className="hidden sm:block mb-6">
                    <Breadcrumbs items={breadcrumbsFormatted} />
                </div>

                {/* Mobile Breadcrumb - Simple version */}
                <div className="sm:hidden mb-4 text-sm text-gray-600">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M19 12H5M12 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back
                    </button>
                </div>

                {/* Main Product Section - Matching product detail layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-12">
                    {/* Left Column - Product Images (5/12 on desktop, matching product page) */}
                    <div className="lg:col-span-6 space-y-4 sm:space-y-5">
                        {/* Product Gallery */}
                        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100">
                            <ProductGallery
                                images={images}
                                fallbackIcon={<ShoppingCart className="w-24 h-24 text-[#008ECC]" />}
                            />
                        </div>
                    </div>

                    {/* Right Column - Product Info, Pricing, Upload & Customization (7/12 on desktop) */}
                    <div className="lg:col-span-6">
                        <div className="sticky top-24 space-y-4 sm:space-y-6">
                            {/* Product Title */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3">
                                    {productData.title || 'Service'}
                                </h1>
                                {productData.description && (
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        {productData.description}
                                    </p>
                                )}
                            </div>



                            {/* Features */}
                            {productData.features && productData.features.length > 0 && (
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100">
                                    <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
                                    <ProductFeatures features={productData.features} />
                                </div>
                            )}

                            {/* File Upload Section */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                {!hideFileUpload ? (
                                    <div className="space-y-4">
                                        <ProductDocumentUpload
                                            onFileSelect={(files: File[], pageCount: number, fileDetails?: FileDetail[]) => {
                                                // Use the new callback if provided, otherwise use legacy callback
                                                if (onFileSelectWithQuantity) {
                                                    onFileSelectWithQuantity(files, pageCount, fileDetails);
                                                } else {
                                                    // Legacy: pass first file to onFileSelect
                                                    const firstFile: File | null = files.length > 0 && files[0] ? files[0] : null;
                                                    onFileSelect(firstFile);
                                                }
                                            }}
                                            onQuantityChange={(calculatedQuantity: number) => {
                                                // Call the quantity change callback if provided
                                                if (onQuantityChange && calculatedQuantity > 0) {
                                                    onQuantityChange(calculatedQuantity);
                                                }
                                            }}
                                            maxSizeMB={50}
                                            uploadedFilesS3={uploadedFilesS3}
                                            setUploadedFilesS3={setUploadedFilesS3}
                                        />
                                        {uploadedFilesS3 && uploadedFilesS3.length >= 1 && (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                <p className="text-xs sm:text-sm text-amber-900 font-medium">
                                                    You can upload multiple PDFs at once.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    templateSelector
                                )}

                                {/* Password-protected file info - Show always if password is set or files are uploaded */}
                                {hasUploadedFilesNow && (
                                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="file-has-password"
                                                checked={fileHasPassword && hasUploadedFilesNow}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    onFileHasPasswordChange?.(checked);
                                                    if (!checked) {
                                                        onFilePasswordChange?.('');
                                                        onPasswordSubmittedChange?.(false);
                                                    }
                                                }}
                                                disabled={!hasUploadedFilesNow}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <label htmlFor="file-has-password" className="text-sm font-medium text-gray-700 cursor-pointer">
                                                File has password?
                                            </label>
                                        </div>

                                        {fileHasPassword && hasUploadedFilesNow && (
                                            <div className="mt-3">
                                                {!isPasswordSubmitted ? (
                                                    <MultiplePasswordsEditor
                                                        filePassword={filePassword}
                                                        onFilePasswordChange={onFilePasswordChange}
                                                        onPasswordSubmittedChange={onPasswordSubmittedChange}
                                                    />
                                                ) : (
                                                    <div className="space-y-2">
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Password(s) (shared with admin)
                                                        </label>
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                value={filePassword}
                                                                readOnly
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 text-sm font-mono"
                                                            />
                                                            <Button
                                                                onClick={() => onPasswordSubmittedChange?.(false)}
                                                                variant="outline"
                                                                className="px-4 py-2"
                                                            >
                                                                Edit
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-gray-500">
                                                            Password is saved. Click Edit to change it.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Configuration Options */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customize Your Order</h3>
                                {children}
                            </div>

                            {/* Price Section */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                <PriceBreakdown
                                    items={priceItems}
                                    total={totalPrice}
                                    currency="₹"
                                    basePrice={basePricePerUnit}
                                    pageCount={pageCount}
                                    originalPageCount={originalPageCount}
                                    hasHalfPageAdjustment={hasHalfPageAdjustment}
                                    copies={copies}
                                    quantity={quantity}
                                    calculatingPrice={calculatingPrice}
                                />

                                {/* Stock Status */}
                                {productId && (
                                    <div className="mt-4">
                                        {outOfStock ? (
                                            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-red-800">Out of Stock</span>
                                                </div>
                                                <p className="mt-1 text-xs text-red-600">
                                                    This product is currently unavailable. Please check back later or contact us for availability.
                                                </p>
                                            </div>
                                        ) : stock !== null && stock !== undefined ? (
                                            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-green-800">
                                                        {stock > 0 ? `In Stock (${stock} available)` : 'In Stock'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                                {/* Tax Info */}
                                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                                    Inclusive of all taxes
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-3">
                                <Button
                                    variant="primary"
                                    size="lg"
                                    icon={ShoppingCart}
                                    fullWidth
                                    isLoading={isUploadingFiles || addToCartLoading || calculatingPrice}
                                    disabled={disableAddToCart}
                                    onClick={isInCart ? () => router.push('/cart') : onAddToCart}
                                    className="text-base font-medium"
                                    useCircularLoader={isUploadingFiles}
                                >
                                    {isUploadingFiles
                                        ? 'Loading files...'
                                        : calculatingPrice
                                            ? 'Calculating...'
                                            : addToCartLabel}
                                </Button>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    isLoading={isUploadingFiles || buyNowLoading || calculatingPrice}
                                    disabled={disableBuyNow}
                                    onClick={onBuyNow}
                                    className="text-base font-medium bg-orange-600 hover:bg-orange-700"
                                    useCircularLoader={isUploadingFiles}
                                >
                                    {isUploadingFiles
                                        ? 'Loading files...'
                                        : calculatingPrice
                                            ? 'Calculating...'
                                            : buyNowLabel}
                                </Button>
                                </div>

                                {/* One shared message below buttons (no duplication) */}
                                {actionMessageInfo && (
                                    <div
                                        className={
                                            actionMessageInfo.type === 'error'
                                                ? 'rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800'
                                                : actionMessageInfo.type === 'warning'
                                                    ? 'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900'
                                                    : 'rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900'
                                        }
                                    >
                                        <div className="flex items-start gap-2">
                                            {actionMessageInfo.type === 'error' ? (
                                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            ) : (
                                                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-semibold">{actionMessageInfo.title}</p>
                                                <p className="text-xs sm:text-sm opacity-90">{actionMessageInfo.message}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
