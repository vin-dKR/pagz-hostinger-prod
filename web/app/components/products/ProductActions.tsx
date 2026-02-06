"use client";

import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { BarsSpinner } from "../shared/BarsSpinner";

interface ProductActionsProps {
    stock: number;
    onAddToCart: () => Promise<void>;
    onBuyNow: () => Promise<void>;
    addToCartLoading: boolean;
    buyNowLoading: boolean;
    isMobile?: boolean;
    isInCart?: boolean;
    hasFiles?: boolean; // Whether files have been uploaded
    totalPrice?: number; // Total price to display
    calculatingPrice?: boolean; // Whether price is being calculated
    isUploadingFiles?: boolean; // Whether files are currently uploading
}

export default function ProductActions({
    stock,
    onAddToCart,
    onBuyNow,
    addToCartLoading,
    buyNowLoading,
    isMobile = false,
    isInCart = false,
    hasFiles = false,
    totalPrice = 0,
    calculatingPrice = false,
    isUploadingFiles = false,
}: ProductActionsProps) {
    const router = useRouter();
    const handleAddToCartClick = () => {
        if (isInCart) {
            router.push('/cart');
        } else {
            onAddToCart();
        }
    };

    // Disable buttons if no files uploaded, price is calculating, or files are uploading
    const isDisabled = stock === 0 || !hasFiles || calculatingPrice || isUploadingFiles;
    const addToCartDisabled = isDisabled || addToCartLoading || (isInCart ? false : !hasFiles);
    const buyNowDisabled = isDisabled || buyNowLoading || !hasFiles;

    // Circular loader component for file uploads
    const CircularLoader = ({ size = 16 }: { size?: number }) => (
        <div className="relative" style={{ width: size, height: size }}>
            <div
                className="border-2 border-white border-t-transparent rounded-full animate-spin"
                style={{ width: size, height: size }}
            ></div>
        </div>
    );

    if (isMobile) {
        return (
            <div className="flex gap-3 w-full">
                <button
                    onClick={handleAddToCartClick}
                    disabled={addToCartDisabled}
                    className="flex-1 px-4 py-3 bg-[#008ECC] text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                    {isUploadingFiles ? (
                        <CircularLoader size={16} />
                    ) : addToCartLoading ? (
                        <BarsSpinner size={16} />
                    ) : null}
                    {stock === 0
                        ? "Out of Stock"
                        : !hasFiles
                            ? "Upload File First"
                            : isUploadingFiles
                                ? "Loading files..."
                                : addToCartLoading
                                    ? "Adding..."
                                    : isInCart
                                        ? "Go to Cart"
                                        : totalPrice > 0
                                            ? `Add to Cart - ₹${totalPrice.toFixed(2)}`
                                            : "Add to Cart"}
                </button>
                <button
                    onClick={onBuyNow}
                    disabled={buyNowDisabled}
                    className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                    {isUploadingFiles ? (
                        <CircularLoader size={16} />
                    ) : buyNowLoading ? (
                        <BarsSpinner size={16} />
                    ) : null}
                    {!hasFiles
                        ? "Upload File First"
                        : isUploadingFiles
                            ? "Loading files..."
                            : buyNowLoading
                                ? "Processing..."
                                : "Buy Now"}
                </button>
            </div>
        );
    }

    return (
        <div className="flex gap-4">
            <button
                onClick={handleAddToCartClick}
                disabled={addToCartDisabled}
                className="flex-1 px-8 py-4 bg-[#008ECC] text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
            >
                {isUploadingFiles ? (
                    <CircularLoader size={20} />
                ) : addToCartLoading ? (
                    <BarsSpinner size={20} />
                ) : (
                    <ShoppingBag size={20} />
                )}
                {stock === 0
                    ? "Out of Stock"
                    : !hasFiles
                        ? "Upload File First"
                        : isUploadingFiles
                            ? "Loading files..."
                            : addToCartLoading
                                ? "Adding..."
                                : isInCart
                                    ? "Go to Cart"
                                    : totalPrice > 0
                                        ? `Add to Cart - ₹${totalPrice.toFixed(2)}`
                                        : "Add to Cart"}
            </button>
            <button
                onClick={onBuyNow}
                disabled={buyNowDisabled}
                className="flex-1 px-8 py-4 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
                {isUploadingFiles ? (
                    <CircularLoader size={20} />
                ) : buyNowLoading ? (
                    <BarsSpinner size={20} />
                ) : null}
                {!hasFiles
                    ? "Upload File First"
                    : isUploadingFiles
                        ? "Loading files..."
                        : buyNowLoading
                            ? "Processing..."
                            : "Buy Now"}
            </button>
        </div>
    );
}

