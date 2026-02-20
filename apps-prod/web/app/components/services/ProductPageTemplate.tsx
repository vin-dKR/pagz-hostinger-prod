'use client';

import React, { useEffect, useRef } from 'react';
import { ProductGallery } from './ProductGallery';
import { ProductFeatures } from './ProductFeatures';
import { PriceBreakdown } from './print/PriceBreakdown';
import { Button } from './print/Button';
import { ShoppingCart } from 'lucide-react';
import { ProductData, BreadcrumbItem } from '@/types';
import Breadcrumbs from '../Breadcrumbs';
import { useRouter } from 'next/navigation';
import ProductDocumentUpload, { FileDetail } from '../products/ProductDocumentUpload';
import { toastError } from '@/lib/utils/toast';

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
    pageCount?: number; // For price breakdown display
    copies?: number; // For price breakdown display
    quantity?: number; // For price breakdown display
    hasUploadedFiles?: boolean; // Whether files have been uploaded
    calculatingPrice?: boolean; // Whether price is being calculated
    isUploadingFiles?: boolean; // Whether files are currently uploading
    uploadedFilesS3: FileDetail[]
    setUploadedFilesS3: React.Dispatch<React.SetStateAction<FileDetail[]>>
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
    copies,
    quantity,
    hasUploadedFiles = false,
    calculatingPrice = false,
    isUploadingFiles = false,
    uploadedFilesS3,
    setUploadedFilesS3
}) => {
    const router = useRouter();
    const outOfStock = isOutOfStock || (stock !== null && stock !== undefined && stock <= 0);
    const prevOutOfStockRef = useRef<boolean | null>(null);

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

    // Determine button disabled state and message
    const isButtonDisabled = outOfStock || !hasUploadedFiles || !areRequiredFieldsFilled || calculatingPrice;
    const getButtonText = (isAddToCart: boolean) => {
        if (outOfStock) return 'Out of Stock';
        if (isInCart && isAddToCart) return 'Go to Cart';
        if (!hasUploadedFiles) return 'Upload the files first';
        if (!areRequiredFieldsFilled) return 'Please select the mandatory field';
        if (isAddToCart) return `Add to Cart to Buy - ₹${totalPrice.toFixed(2)}`;
        return 'Buy Now';
    };

    // Transform breadcrumb items to match Breadcrumbs component format
    const breadcrumbsFormatted = breadcrumbItems.map(item => ({
        label: item.label,
        href: item.href,
        isActive: item.isActive
    }));
    return (
        <div className="min-h-screen bg-white py-8 pb-24">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
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

                            {/* Price Section */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                <PriceBreakdown
                                    items={priceItems}
                                    total={totalPrice}
                                    currency="₹"
                                    basePrice={basePricePerUnit}
                                    pageCount={pageCount}
                                    copies={copies}
                                    quantity={quantity}
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

                            {/* Features */}
                            {productData.features && productData.features.length > 0 && (
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100">
                                    <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
                                    <ProductFeatures features={productData.features} />
                                </div>
                            )}

                            {/* File Upload Section */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
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
                            </div>

                            {/* Configuration Options */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customize Your Order</h3>
                                {children}
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <Button
                                    variant="primary"
                                    size="lg"
                                    icon={ShoppingCart}
                                    fullWidth
                                    isLoading={isUploadingFiles || addToCartLoading || calculatingPrice}
                                    disabled={isButtonDisabled || isUploadingFiles || addToCartLoading || calculatingPrice}
                                    onClick={isInCart ? () => router.push('/cart') : onAddToCart}
                                    className="text-base font-medium"
                                    useCircularLoader={isUploadingFiles}
                                >
                                    {isUploadingFiles
                                        ? 'Loading files...'
                                        : calculatingPrice
                                            ? 'Calculating...'
                                            : getButtonText(true)}
                                </Button>

                                {/* FUTURE: Add Buy Now button */}
                                {/* <Button
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    isLoading={isUploadingFiles || buyNowLoading || calculatingPrice}
                                    disabled={isButtonDisabled || isUploadingFiles || buyNowLoading || calculatingPrice}
                                    onClick={onBuyNow}
                                    className="font-medium"
                                    useCircularLoader={isUploadingFiles}
                                >
                                    {isUploadingFiles
                                        ? 'Loading files...'
                                        : calculatingPrice
                                            ? 'Calculating...'
                                            : getButtonText(false)}
                                </Button> */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};
