"use client";

import Image from "next/image";
import Link from "next/link";
import { CartItem } from "@/lib/api/cart";
import { FileText } from "lucide-react";

interface OrderReviewProps {
    items: CartItem[];
}

export default function OrderReview({ items }: OrderReviewProps) {
    return (
        <div className="space-y-4">
            {items.map((item) => {
                const product = item.product;
                const variant = item.variant;
                const productImage =
                    product?.images?.find((img) => img.isPrimary)?.url ||
                    product?.images?.[0]?.url ||
                    "/images/placeholder.png";
                const productName = product?.name || "Unknown Product";
                const basePrice = Number(product?.sellingPrice || product?.basePrice || 0);
                const variantModifier = Number(variant?.priceModifier || 0);
                const itemPrice = basePrice + variantModifier;
                // Get uploaded files from cart item (S3 URLs already stored)
                const uploadedFileUrls = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl
                    : (item.customDesignUrl ? [item.customDesignUrl] : []);

                return (
                    <div key={item.id} className="flex gap-3">
                        <Link
                            href={`/products/${item.productId}`}
                            className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shrink-0"
                        >
                            <Image
                                src={productImage}
                                alt={productName}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                            />
                        </Link>
                        <div className="flex-1 min-w-0">
                            <Link href={`/products/${item.productId}`}>
                                <h4 className="font-medium text-gray-900 text-sm hover:text-blue-600 transition-colors truncate">
                                    {productName}
                                </h4>
                            </Link>
                            {variant && (
                                <p className="text-xs text-gray-600">Size: {variant.name}</p>
                            )}

                            {/* Uploaded Files - Show if files are uploaded (S3 URLs stored in cart) */}
                            {uploadedFileUrls.length > 0 && (
                                <div className="mt-1.5 mb-1.5">
                                    <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        Files ({uploadedFileUrls.length})
                                    </div>
                                </div>
                            )}

                            <p className="text-sm font-hkgb font-bold text-gray-900 mt-1">
                                ₹{itemPrice.toFixed(2)} × {item.quantity}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

