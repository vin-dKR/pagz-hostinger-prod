"use client";

import Image from "next/image";
import { CartItem } from "@/lib/api/cart";
import { FileText } from "lucide-react";
import { getPublicS3Url } from "@/lib/utils/s3";
import { AddonBreakdownRows } from "./AddonBreakdownRows";
import { buildAddonLabelMap } from "@/lib/utils/addon-label";

interface OrderReviewProps {
    items: CartItem[];
}

const toNumber = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

export default function OrderReview({ items }: OrderReviewProps) {
    return (
        <div className="space-y-4">
            {items.map((item) => {
                const product = item.product;
                const variant = item.variant;
                const rawImage =
                    product?.images?.find((img) => img.isPrimary)?.url ||
                    product?.images?.[0]?.url ||
                    "";
                const productImage = rawImage
                    ? getPublicS3Url(rawImage)
                    : "/images/placeholder.png";
                const productName = product?.name || "Unknown Product";

                // Server-authoritative pricing — see `cartController.getCart`
                // Phase 1 of per-file addon pricing rolled all the math up
                // into one engine on the api side.
                const finalBaseTotal = toNumber(item.pricing?.baseTotal);
                const finalAddonTotal = toNumber(item.pricing?.addonTotal);
                const finalTotal = toNumber(item.pricing?.total);

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
                                {item.pricing?.addons && item.pricing.addons.length > 0 && (() => {
                                    // Drop addon rules that didn't fire for this
                                    // line (e.g. binding tiers whose page range
                                    // doesn't cover the uploaded file).
                                    // `computeAddonLineTotal` returns 0 for
                                    // those — surfacing them as ₹0.00 rows
                                    // looks broken even though the math is
                                    // correct. Mirrors PR #72's filter on the
                                    // per-file `AddonBreakdownRows` sub-rows.
                                    const pricedAddons = item.pricing.addons.filter(
                                        (addon) => toNumber(addon.total) > 0,
                                    );
                                    if (pricedAddons.length === 0) return null;
                                    // Label map built from the priced subset so
                                    // duplicate-name disambiguation only runs
                                    // across addons the user actually sees.
                                    const labels = buildAddonLabelMap(pricedAddons);
                                    return (
                                    <div className="mt-1 pl-2 border-l-2 border-purple-200">
                                        {pricedAddons.map((addon) => (
                                            <div key={addon.ruleId} className="mb-1 last:mb-0">
                                                <div className="text-xs text-purple-700">
                                                    {labels.get(addon.ruleId) ?? addon.name}: ₹{toNumber(addon.total).toFixed(2)}
                                                </div>
                                                {/* Phase 3 — per-file sub-rows
                                                    surface for `perFileEvaluation`
                                                    addons when 2+ files were
                                                    uploaded. `AddonBreakdownRows`
                                                    filters `price <= 0` entries
                                                    internally and collapses to
                                                    the parent row when only one
                                                    priced file remains. */}
                                                {addon.breakdown && addon.breakdown.length > 1 && (
                                                    <AddonBreakdownRows
                                                        breakdown={addon.breakdown}
                                                        variant="compact"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    );
                                })()}
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

