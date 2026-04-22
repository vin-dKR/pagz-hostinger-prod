"use client";

/**
 * GuestCart
 *
 * Renders the pending-purchase item stored in sessionStorage when a
 * logged-out user adds something to their cart. Replaces the classic
 * "you must log in" gate for `/cart` — the login redirect now happens
 * only on Checkout.
 *
 * Data sources:
 *   - `pending-purchase.ts` (sessionStorage) — set by product/service pages.
 *   - `products` / `categories` API — hydrate display metadata (name,
 *     image, price) that's not duplicated into sessionStorage.
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
} from "@/lib/utils/pending-purchase";
import { redirectGuestToLoginForCheckout } from "@/lib/utils/guest-cart";
import { getProduct, type Product } from "@/lib/api/products";

interface GuestCartProps {
    onEmpty?: () => void;
}

type DisplayItem = {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    quantity: number;
    unitPriceLabel?: string;
    totalPrice?: number;
    specChips?: { label: string; value: string }[];
    fileChips?: { name: string; imageUrl?: string }[];
};

function formatPrice(value: number): string {
    if (!Number.isFinite(value)) return "-";
    return `₹${value.toFixed(2)}`;
}

function buildServiceDisplay(pending: PendingPurchaseData): DisplayItem {
    const specs = Object.entries(pending.specifications || {}).map(([label, value]) => ({
        label,
        value: String(value),
    }));

    const fileChips = (pending.files || []).map((file) => {
        // Only preview via <Image> when we have an http(s) URL (S3-hosted).
        // Base64 / blob URLs are skipped — the `FileText` icon is rendered
        // instead to avoid Next/Image complaining about unsupported sources.
        const s3Url = file.s3Key ? getPublicS3Url(file.s3Key) : undefined;
        return {
            name: file.name || getFilenameFromS3Key(file.s3Key || "") || "Uploaded file",
            imageUrl: file.type === "image" && s3Url ? s3Url : undefined,
        };
    });

    return {
        title: pending.categorySlug
            ? pending.categorySlug
                  .split("-")
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(" ")
            : "Print Service",
        subtitle: pending.copies
            ? `${pending.copies} ${pending.copies === 1 ? "copy" : "copies"}${pending.pageCount ? ` · ${pending.pageCount} pages` : ""}`
            : undefined,
        quantity: pending.quantity || 1,
        totalPrice: pending.totalPrice,
        specChips: specs,
        fileChips,
    };
}

function buildProductDisplay(pending: PendingPurchaseData, product: Product | null): DisplayItem {
    const primaryImage = product?.images?.find((img) => img.isPrimary) || product?.images?.[0];
    const unit = product?.sellingPrice ?? product?.basePrice;
    const quantity = pending.quantity || 1;
    const total = typeof unit === "number" ? unit * quantity : undefined;

    return {
        title: product?.name || "Product",
        subtitle: product?.shortDescription || product?.category?.name,
        imageUrl: primaryImage?.url,
        quantity,
        unitPriceLabel: typeof unit === "number" ? formatPrice(unit) : undefined,
        totalPrice: total,
    };
}

export default function GuestCart({ onEmpty }: GuestCartProps) {
    const [pending, setPending] = useState<PendingPurchaseData | null>(null);
    const [product, setProduct] = useState<Product | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    // Hydrate from sessionStorage once on mount.
    useEffect(() => {
        setPending(getPendingPurchaseData());
        setHydrated(true);
    }, []);

    // For "product" intents, fetch the product so we can render a real card.
    useEffect(() => {
        if (!pending || pending.type !== "product" || !pending.productId) {
            setProduct(null);
            return;
        }

        let cancelled = false;
        setLoadingProduct(true);
        (async () => {
            try {
                const response = await getProduct(pending.productId!);
                if (!cancelled && response.success && response.data) {
                    setProduct(response.data);
                }
            } catch {
                // Non-fatal; the display falls back to "Product"
            } finally {
                if (!cancelled) setLoadingProduct(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [pending]);

    const display = useMemo<DisplayItem | null>(() => {
        if (!pending) return null;
        return pending.type === "service"
            ? buildServiceDisplay(pending)
            : buildProductDisplay(pending, product);
    }, [pending, product]);

    const handleRemove = useCallback(() => {
        clearPendingPurchaseData();
        setPending(null);
        onEmpty?.();
    }, [onEmpty]);

    const handleCheckout = useCallback(() => {
        redirectGuestToLoginForCheckout("/checkout");
    }, []);

    // Wait for hydration so we don't flash "empty cart" before sessionStorage is read.
    if (!hydrated) {
        return null;
    }

    if (!pending || !display) {
        return (
            <EmptyGuestCart />
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Pending item card */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6">
                    <div className="flex gap-4">
                        <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                            {display.imageUrl ? (
                                <Image
                                    src={display.imageUrl}
                                    alt={display.title}
                                    fill
                                    className="object-cover"
                                    sizes="112px"
                                    loader={imageLoader}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <ShoppingCart className="w-8 h-8" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2">
                                        {loadingProduct ? "Loading..." : display.title}
                                    </h3>
                                    {display.subtitle && (
                                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">
                                            {display.subtitle}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={handleRemove}
                                    className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    aria-label="Remove from cart"
                                    type="button"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {display.specChips && display.specChips.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {display.specChips.map((chip) => (
                                        <span
                                            key={`${chip.label}-${chip.value}`}
                                            className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                                        >
                                            <span className="text-gray-500">{chip.label}:</span> {chip.value}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {display.fileChips && display.fileChips.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {display.fileChips.map((file, idx) => (
                                        <div
                                            key={`${file.name}-${idx}`}
                                            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100"
                                        >
                                            {file.imageUrl && isImageFile(file.name) ? (
                                                <Image
                                                    src={file.imageUrl}
                                                    alt={file.name}
                                                    width={16}
                                                    height={16}
                                                    className="rounded object-cover"
                                                    loader={imageLoader}
                                                />
                                            ) : (
                                                <FileText size={12} />
                                            )}
                                            <span className="truncate max-w-[160px]">{file.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-3">
                                <div className="text-sm text-gray-600">
                                    Qty: <span className="font-medium text-gray-900">{display.quantity}</span>
                                    {display.unitPriceLabel && (
                                        <span className="ml-2 text-gray-500">
                                            ({display.unitPriceLabel} each)
                                        </span>
                                    )}
                                </div>
                                {typeof display.totalPrice === "number" && (
                                    <div className="text-base sm:text-lg font-semibold text-gray-900">
                                        {formatPrice(display.totalPrice)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                    Your selection is saved on this device. Log in at checkout to finalize and pay.
                </p>
            </div>

            {/* Guest summary & checkout */}
            <div className="lg:col-span-1">
                <div className="sticky top-4">
                    <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-3">
                        <h2 className="text-lg font-hkgb font-semibold text-gray-900">Order Summary</h2>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Items</span>
                            <span>{display.quantity}</span>
                        </div>

                        {typeof display.totalPrice === "number" && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-base font-semibold text-gray-900">
                                <span>Estimated Total</span>
                                <span>{formatPrice(display.totalPrice)}</span>
                            </div>
                        )}

                        <button
                            onClick={handleCheckout}
                            className="w-full mt-2 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base text-white bg-[#1EADD8] hover:bg-blue-700 transition-colors font-medium"
                            type="button"
                        >
                            Log in & Checkout
                        </button>
                        <p className="text-[11px] text-gray-500 text-center">
                            You'll be asked to sign in to complete the purchase.
                        </p>
                    </div>
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
