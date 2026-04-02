"use client";

import Image from "next/image";
import { CartItem, AddonRule } from "@/lib/api/cart";
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
                
                // Get pricing from backend pricing object if available
                const pricing = (item as any).pricing;
                const baseTotal = pricing?.baseTotal ?? 0;
                const addonTotal = pricing?.addonTotal ?? 0;
                const total = pricing?.total ?? 0;
                
                // Fallback: calculate from product/variant
                const basePrice = Number(product?.sellingPrice || product?.basePrice || 0);
                const variantModifier = Number(variant?.priceModifier || 0);
                const itemBasePrice = basePrice + variantModifier;
                
                // Calculate addon total if not in pricing object
                let calculatedAddonTotal = addonTotal;
                if (!pricing && item.addons && item.addons.length > 0) {
                    calculatedAddonTotal = (item.addons as AddonRule[]).reduce((sum, addon) => {
                        const price =
                            (addon.priceModifier ?? undefined) !== undefined
                                ? Number(addon.priceModifier)
                                : (addon.basePrice ?? undefined) !== undefined
                                    ? Number(addon.basePrice)
                                    : 0;
                        const multiplier = addon.quantityMultiplier ? item.quantity : 1;
                        return sum + (price * multiplier);
                    }, 0);
                }
                
                const finalBaseTotal = baseTotal || (itemBasePrice * item.quantity);
                const finalAddonTotal = calculatedAddonTotal;
                const finalTotal = total || (finalBaseTotal + finalAddonTotal);
                
                // Get uploaded files from cart item (S3 URLs already stored)
                const uploadedFileUrls = Array.isArray(item.customDesignUrl)
                    ? item.customDesignUrl
                    : (item.customDesignUrl ? [item.customDesignUrl] : []);

                return (
                    <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                            <Image
                                src={productImage}
                                alt={productName}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">
                                {productName}
                            </h4>
                            {variant && (
                                <p className="text-xs text-gray-600">Size: {variant.name}</p>
                            )}

                            {/* Template Form Data - Show if template form data exists */}
                            {item.metadata?.templateId && item.metadata?.templateFormData && Object.keys(item.metadata.templateFormData).length > 0 && (
                                <div className="mt-1.5 mb-1.5">
                                    <div className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        Template Form Data
                                    </div>
                                    <div className="mt-1 space-y-0.5 pl-4 border-l-2 border-amber-200">
                                        {Object.entries(item.metadata.templateFormData).map(([key, value]) => (
                                            <div key={key} className="text-xs text-amber-600">
                                                <span className="font-medium">{key}:</span>{' '}
                                                <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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

                            {/* Pricing Breakdown */}
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Base Price:</span>
                                    <span className="font-medium">₹{finalBaseTotal.toFixed(2)}</span>
                                </div>
                                {finalAddonTotal > 0 && (
                                    <div className="flex justify-between text-xs text-gray-600">
                                        <span>Addons:</span>
                                        <span className="font-medium">₹{finalAddonTotal.toFixed(2)}</span>
                                    </div> 
                                )}
                                {item.addons && item.addons.length > 0 && (
                                    <div className="mt-1 pl-2 border-l-2 border-purple-200">
                                        {(item.addons as AddonRule[]).map((addon, idx) => {
                                            const specValues = (addon.specificationValues || {}) as Record<string, any>;
                                            const specDetails = Object.entries(specValues)
                                                .map(([key, value]) => `${key}: ${value}`)
                                                .join(', ');
                                            const price =
                                                (addon.priceModifier ?? undefined) !== undefined
                                                    ? Number(addon.priceModifier)
                                                    : (addon.basePrice ?? undefined) !== undefined
                                                        ? Number(addon.basePrice)
                                                        : 0;
                                            const multiplier = addon.quantityMultiplier ? item.quantity : 1;
                                            const addonItemTotal = price * multiplier;
                                            return (
                                                <div key={idx} className="text-xs text-purple-700 mb-0.5">
                                                    {specDetails || `Addon #${idx + 1}`}: ₹{price.toFixed(2)}
                                                    {multiplier > 1 && ` × ${multiplier} = ₹${addonItemTotal.toFixed(2)}`}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex justify-between text-sm font-hkgb font-bold text-gray-900 mt-1 pt-1 border-t border-gray-200">
                                    <span>Total:</span>
                                    <span>₹{finalTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

