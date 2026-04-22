"use client";

/**
 * GuestCart
 *
 * Renders the pending-purchase item stored in sessionStorage when a
 * logged-out user adds something to their cart. Mirrors the real CartItem
 * UI (image, file previews, spec chips, price breakdown, addon lines)
 * and uses the same BillingSummary component so guests see the same
 * layout they'll see after login.
 */

import Image from "next/image";
import Link from "next/link";
import { FileText, ShoppingCart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { imageLoader } from "@/lib/utils/image-loader";
import { getPublicS3Url, getFilenameFromS3Key, isImageFile } from "@/lib/utils/s3";
import {
    clearPendingPurchaseData,
    getPendingPurchaseData,
    type PendingPurchaseData,
    type PendingPurchaseFile,
} from "@/lib/utils/pending-purchase";
import { redirectGuestToLoginForCheckout } from "@/lib/utils/guest-cart";
import { getProduct, type Product } from "@/lib/api/products";
import { getCategoryBySlug, getCategoryAddons, type Category, type CategoryAddon } from "@/lib/api/categories";
import BillingSummary from "./BillingSummary";
import type { AddonRule } from "@/lib/api/cart";
import { computeAddonLineTotal, getAddonLabel } from "@/lib/utils/addon-pricing";

interface GuestCartProps {
    onEmpty?: () => void;
}

function formatPrice(value: number): string {
    if (!Number.isFinite(value)) return "-";
    return `₹${value.toFixed(2)}`;
}

function pickCategoryImage(category: Category | null): string | undefined {
    if (!category) return undefined;
    if (category.images && category.images.length > 0) {
        const primary = category.images.find((img) => img.isPrimary);
        const url = primary?.url || category.images[0]?.url;
        if (url) return url.startsWith("/") ? url : getPublicS3Url(url);
    }
    if (category.image) {
        return category.image.startsWith("/") ? category.image : getPublicS3Url(category.image);
    }
    return undefined;
}

function pickProductImage(product: Product | null): string | undefined {
    if (!product?.images || product.images.length === 0) return undefined;
    const primary = product.images.find((img) => img.isPrimary);
    const url = primary?.url || product.images[0]?.url;
    if (!url) return undefined;
    return url.startsWith("/") ? url : getPublicS3Url(url);
}

function toTitle(slug: string): string {
    return slug
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

/** Translate stored PendingPurchaseFile + any s3Key into a renderable file chip. */
function fileChipFromPending(file: PendingPurchaseFile) {
    const hasS3 = !!file.s3Key;
    const fileUrl = hasS3 ? getPublicS3Url(file.s3Key!) : undefined;
    const name = file.name || getFilenameFromS3Key(file.s3Key || "") || "Uploaded file";
    // Only show image preview when the file is an image AND we have an http URL
    // (base64 / blob URLs would break next/image).
    const showImagePreview = !!fileUrl && file.type === "image" && isImageFile(name);
    return { name, fileUrl, showImagePreview };
}

export default function GuestCart({ onEmpty }: GuestCartProps) {
    const [pending, setPending] = useState<PendingPurchaseData | null>(null);
    const [product, setProduct] = useState<Product | null>(null);
    const [category, setCategory] = useState<Category | null>(null);
    const [categoryAddons, setCategoryAddons] = useState<CategoryAddon[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    // Hydrate from sessionStorage once on mount.
    useEffect(() => {
        setPending(getPendingPurchaseData());
        setHydrated(true);
    }, []);

    // Fetch product / category + addon metadata so we can render labels, images,
    // and addon prices that match the real cart UI.
    useEffect(() => {
        if (!pending) {
            setProduct(null);
            setCategory(null);
            setCategoryAddons([]);
            return;
        }

        let cancelled = false;
        setLoadingDetails(true);

        (async () => {
            try {
                if (pending.type === "product" && pending.productId) {
                    const res = await getProduct(pending.productId);
                    if (!cancelled && res.success && res.data) setProduct(res.data);
                } else if (pending.type === "service" && pending.categorySlug) {
                    const [cat, addons] = await Promise.all([
                        getCategoryBySlug(pending.categorySlug).catch(() => null),
                        getCategoryAddons(pending.categorySlug).catch(() => [] as CategoryAddon[]),
                    ]);
                    if (!cancelled) {
                        setCategory(cat);
                        setCategoryAddons(addons);
                    }
                }
            } finally {
                if (!cancelled) setLoadingDetails(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [pending]);

    const handleRemove = useCallback(() => {
        clearPendingPurchaseData();
        setPending(null);
        onEmpty?.();
    }, [onEmpty]);

    const handleCheckout = useCallback(() => {
        redirectGuestToLoginForCheckout("/checkout");
    }, []);

    // Resolve the main display image: S3 uploaded file (image) > product image > category image > placeholder.
    const displayImage = useMemo<string | undefined>(() => {
        if (!pending) return undefined;
        const firstImageFile = (pending.files || []).find(
            (f) => f.s3Key && f.type === "image" && isImageFile(f.name || f.s3Key || "")
        );
        if (firstImageFile?.s3Key) return getPublicS3Url(firstImageFile.s3Key);
        if (pending.type === "product") return pickProductImage(product);
        return pickCategoryImage(category);
    }, [pending, product, category]);

    const title = useMemo(() => {
        if (!pending) return "";
        if (pending.type === "product") return product?.name || "Product";
        return category?.name || (pending.categorySlug ? toTitle(pending.categorySlug) : "Print Service");
    }, [pending, product, category]);

    const subtitle = useMemo(() => {
        if (!pending) return undefined;
        if (pending.type === "product") return product?.shortDescription || product?.category?.name;
        if (pending.copies) {
            return `${pending.copies} ${pending.copies === 1 ? "copy" : "copies"}${pending.pageCount ? ` · ${pending.pageCount} pages` : ""
                }`;
        }
        return undefined;
    }, [pending, product]);

    const specChips = useMemo(() => {
        if (!pending || pending.type !== "service") return [];
        return Object.entries(pending.specifications || {}).map(([label, value]) => ({
            label,
            value: String(value),
        }));
    }, [pending]);

    const fileChips = useMemo(() => {
        if (!pending) return [];
        return (pending.files || []).map(fileChipFromPending);
    }, [pending]);

    // Resolve the selected addon ids from the pending data, then look up the
    // full rule from the category addons list so we can show label + price.
    const resolvedAddons = useMemo<AddonRule[]>(() => {
        if (!pending) return [];
        const ids = pending.selectedAddons || pending.metadata?.selectedAddons || [];
        if (ids.length === 0) return [];
        const byId = new Map(categoryAddons.map((a) => [a.id, a]));
        return ids
            .map((id) => byId.get(id))
            .filter((a): a is CategoryAddon => !!a)
            .map<AddonRule>((a) => ({
                id: a.id,
                categoryId: a.categoryId,
                ruleType: "ADDON",
                specificationValues: a.specificationValues,
                priceModifier: a.priceModifier,
                basePrice: null,
                quantityMultiplier: false,
                minQuantity: a.minQuantity,
                maxQuantity: a.maxQuantity,
            }));
    }, [pending, categoryAddons]);

    // Derive a price breakdown from the pending metadata (set by the service
    // page). Falls back to pending.totalPrice / currentPrice when missing.
    const priceBreakdown = useMemo(() => {
        if (!pending) return { baseTotal: 0, addonTotal: 0, total: 0 };
        const breakdown = pending.metadata?.priceBreakdown;
        if (breakdown && breakdown.length > 0) {
            const base = breakdown.find((x) => x.label.toLowerCase().startsWith("base"))?.value ?? 0;
            const addons = breakdown
                .filter((x) => !x.label.toLowerCase().startsWith("base"))
                .reduce((sum, x) => sum + Number(x.value || 0), 0);
            return {
                baseTotal: Number(base) || 0,
                addonTotal: Number(addons) || 0,
                total: (Number(base) || 0) + (Number(addons) || 0),
            };
        }
        const total = Number(pending.totalPrice || pending.currentPrice || 0);
        return { baseTotal: total, addonTotal: 0, total };
    }, [pending]);

    const quantity = pending?.quantity || 1;

    // Wait for hydration so we don't flash "empty cart" before sessionStorage is read.
    if (!hydrated) return null;

    if (!pending) {
        return <EmptyGuestCart />;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Left Column — pending item card (mirrors CartItem visual layout) */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 relative">
                        {/* Delete (top-right on desktop, top-right on mobile too) */}
                        <button
                            onClick={handleRemove}
                            className="absolute top-0 right-0 p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            aria-label="Remove from cart"
                            type="button"
                        >
                            <Trash2 size={18} />
                        </button>

                        {/* Product Image — larger on desktop, matching CartItem */}
                        <div className="shrink-0">
                            <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                {displayImage ? (
                                    <Image
                                        src={displayImage}
                                        alt={title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 96px, (max-width: 1024px) 128px, 160px"
                                        loader={imageLoader}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ShoppingCart className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0 pr-8">
                            <h3 className="font-bold text-base sm:text-lg lg:text-xl text-gray-900 mb-1">
                                {loadingDetails && !title ? "Loading..." : title}
                            </h3>
                            {subtitle && (
                                <p className="text-xs sm:text-sm text-gray-600 mb-2">{subtitle}</p>
                            )}

                            {/* Spec chips */}
                            {specChips.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {specChips.map((chip) => (
                                        <span
                                            key={`${chip.label}-${chip.value}`}
                                            className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                                        >
                                            <span className="text-gray-500">{chip.label}:</span>{" "}
                                            <span className="font-medium">{chip.value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Uploaded file previews — same pattern as CartItem */}
                            {fileChips.length > 0 && (
                                <div className="mb-3 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Uploaded Files ({fileChips.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {fileChips.slice(0, 6).map((file, idx) => (
                                            <div
                                                key={`${file.name}-${idx}`}
                                                className="relative w-12 h-12 rounded border border-gray-200 overflow-hidden bg-white"
                                                title={file.name}
                                            >
                                                {file.showImagePreview && file.fileUrl ? (
                                                    <Image
                                                        src={file.fileUrl}
                                                        alt={file.name}
                                                        fill
                                                        className="object-cover"
                                                        sizes="48px"
                                                        loader={imageLoader}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                                        <FileText className="h-5 w-5 text-gray-500" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Template form data (rare on guest, but include for parity) */}
                            {pending.templateId && pending.templateFormData && Object.keys(pending.templateFormData).length > 0 && (
                                <div className="mb-3 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Template Form Data
                                    </p>
                                    <div className="space-y-1 pl-2 border-l-2 border-amber-200">
                                        {Object.entries(pending.templateFormData).map(([key, value]) => (
                                            <div key={key} className="text-xs text-amber-700">
                                                <span className="font-medium">{key}:</span>{" "}
                                                <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Price breakdown — matches CartItem */}
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-700">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-600">Base:</span>
                                            <span className="font-semibold text-gray-900">
                                                {formatPrice(priceBreakdown.baseTotal)}
                                            </span>
                                        </div>
                                        {priceBreakdown.addonTotal > 0 && (
                                            <>
                                                <span className="hidden sm:inline text-gray-400">+</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-gray-600">Addons:</span>
                                                    <span className="font-semibold text-gray-900">
                                                        {formatPrice(priceBreakdown.addonTotal)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-[11px] sm:text-xs text-gray-500">Total</div>
                                        <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                                            {formatPrice(priceBreakdown.total)}
                                        </div>
                                    </div>
                                </div>

                                {/* Per-addon list so user sees what they picked */}
                                {resolvedAddons.length > 0 && (
                                    <ul className="mt-2 pl-3 border-l-2 border-purple-200 space-y-0.5">
                                        {resolvedAddons.map((addon, idx) => {
                                            const addonTotal = computeAddonLineTotal(addon, {
                                                quantity,
                                                metadata: {
                                                    pageCount: pending.pageCount,
                                                    copies: pending.copies,
                                                } as any,
                                            });
                                            return (
                                                <li key={addon.id} className="text-xs text-purple-700">
                                                    {getAddonLabel(addon, idx)}
                                                    {addonTotal > 0 ? `: ${formatPrice(addonTotal)}` : ""}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                <div className="mt-2 text-xs text-gray-500">
                                    Qty: <span className="font-medium text-gray-900">{quantity}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                    Your selection is saved on this device. Log in at checkout to finalize and pay.
                </p>
            </div>

            {/* Right Column — BillingSummary + Log in & Checkout */}
            <div className="lg:col-span-1">
                <div className="sticky top-4">
                    <BillingSummary
                        mrp={0}
                        subtotal={priceBreakdown.baseTotal}
                        addonsSubtotal={priceBreakdown.addonTotal}
                        discount={0}
                        couponApplied={0}
                        shipping={0}
                        grandTotal={priceBreakdown.total}
                        itemCount={1}
                        showCheckoutActions={false}
                        hideCouponAndShipping={true}
                    />
                    <button
                        onClick={handleCheckout}
                        className="w-full mt-3 sm:mt-4 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base text-white bg-[#1EADD8] hover:bg-blue-700 transition-colors font-medium"
                        type="button"
                    >
                        Checkout
                    </button>
                    <p className="text-[11px] text-gray-500 text-center mt-2">
                        You'll be asked to sign in to complete the purchase.
                    </p>
                </div>
            </div>
        </div>
    );
}

function EmptyGuestCart() {
    return (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-6 sm:p-8 lg:p-12 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-5 rounded-full bg-gray-50 flex items-center justify-center">
                <ShoppingCart className="text-gray-400 w-6 h-6 sm:w-8 sm:h-8" strokeWidth={1.5} />
            </div>
            <p className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Your cart is empty</p>
            <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md mx-auto px-4">
                Looks like you haven't added anything to your cart yet. Start shopping to add items.
            </p>
            <Link
                href="/services"
                className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-500 border border-blue-600 text-white rounded-xl hover:bg-blue-600 transition-all duration-200 font-medium text-sm sm:text-base"
            >
                Continue Shopping
            </Link>
        </div>
    );
}
