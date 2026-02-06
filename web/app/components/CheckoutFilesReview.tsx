"use client";

import { FileText } from "lucide-react";
import Image from "next/image";
import { CartItem } from "@/lib/api/cart";
import { getPublicS3Url, isImageFile, getFilenameFromS3Key } from "@/lib/utils/s3";

interface CheckoutFilesReviewProps {
    cartItems?: CartItem[];
}

export default function CheckoutFilesReview({ cartItems = [] }: CheckoutFilesReviewProps) {

    // Filter cart items that have uploaded files (customDesignUrl)
    const itemsWithFiles = cartItems.filter(item => {
        const fileUrls = Array.isArray(item.customDesignUrl)
            ? item.customDesignUrl
            : (item.customDesignUrl ? [item.customDesignUrl] : []);
        return fileUrls.length > 0;
    });

    if (itemsWithFiles.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Uploaded Files for Order</h3>
            {itemsWithFiles.map((item) => {
                const productName = item.product?.name || `Product ${item.productId}`;
                const variantName = item.variant?.name;
                const fileUrls = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl
                    : (item.customDesignUrl ? [item.customDesignUrl] : []);

                return (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="text-sm font-medium text-gray-900 mb-2">
                            {productName}
                            {variantName && <span className="text-xs text-gray-600 ml-2">({variantName})</span>}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                            Product ID: {item.productId} {item.variantId ? `• Variant ID: ${item.variantId}` : ''}
                        </div>
                        <div className="space-y-2">
                            {fileUrls.map((s3Key, fileIndex) => {
                                const filename = getFilenameFromS3Key(s3Key);
                                const publicUrl = getPublicS3Url(s3Key);
                                const isImage = isImageFile(s3Key);

                                return (
                                    <div key={fileIndex} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200">
                                        <div className="shrink-0 mt-0.5">
                                            {isImage ? (
                                                <div className="relative w-12 h-12 rounded bg-gray-100 overflow-hidden">
                                                    <Image
                                                        src={publicUrl}
                                                        alt={filename}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized={publicUrl.includes('amazonaws.com') || publicUrl.includes('s3.')}
                                                        sizes="48px"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-gray-600" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                                {filename}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                File uploaded to S3
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            Total: {fileUrls.length} file{fileUrls.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

