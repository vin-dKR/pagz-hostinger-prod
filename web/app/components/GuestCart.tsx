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
import { UploadedFileTile } from "./UploadedFileTile";
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
import { useCalculatePricing } from "@/lib/hooks/use-calculate-pricing";
import { AddonBreakdownRows } from "./AddonBreakdownRows";
import { buildAddonLabelMap } from "@/lib/utils/addon-label";
import type { AddonBreakdownEntry } from "@/lib/api/cart";

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

    // Phase 3 — map ftp/s3 url → original filename so the per-file addon
    // breakdown sub-rows show "design.pdf" instead of the opaque url
    // basename. Falls back gracefully inside `AddonBreakdownRows`.
    const resolveFilename = useMemo(() => {
        const map = new Map<string, string>();
        for (const f of pending?.files || []) {
            if (f.s3Key && f.name) map.set(f.s3Key, f.name);
        }
        return (fileUrl: string) => map.get(fileUrl);
    }, [pending]);

    // Live pricing via the public /cart/calculate-pricing endpoint —
    // Phase 1 of per-file addon pricing. The api computes the addon and
    // base totals from the rules currently live for this category, so a
    // guest gets the same number an authenticated user sees in their cart
    // (and an admin rule tweak between guest-add and login surfaces in
    // the post-login merge).
    const pricingFiles = useMemo(() => {
        if (!pending) return undefined;
        const files = (pending.files || [])
            .filter((f) => typeof f.s3Key === "string" && f.s3Key && f.pageCount > 0)
            .map((f) => ({ url: f.s3Key as string, pageCount: f.pageCount }));
        return files.length > 0 ? files : undefined;
    }, [pending]);

    // ── Issue #93 — recompute selectedAddons from the LIVE category data.
    //
    // Previously this passed `pending.selectedAddons` (the snapshot saved
    // at add-to-cart time). That list could differ from what the services
    // page computes live — e.g. a perFile rule that wasn't in the snapshot
    // but is spec-matched today, or an admin rule edit between guest-add
    // and the guest opening the cart. The asymmetry made the server pick
    // a different baseRule / no addons, so guest cart showed
    // `base = total, addons = 0` while services page showed the proper split.
    //
    // Fix: derive the id set the same way services page does
    // (`/services/[categorySlug]/page.tsx` `selectedAddonIds` memo) — filter
    // live `categoryAddons` by stored `pending.specifications`. Falls back
    // to the snapshot when the live addons list hasn't loaded yet so the
    // first render still has *something* to send.
    const computedSelectedAddons = useMemo<string[]>(() => {
        const stored =
            pending?.selectedAddons || pending?.metadata?.selectedAddons || [];
        if (!pending?.specifications || categoryAddons.length === 0) {
            return stored;
        }
        const normalize = (v: unknown) =>
            v === null || v === undefined ? "" : String(v);
        const specs = pending.specifications as Record<string, unknown>;
        return categoryAddons
            .filter((rule) => {
                const ruleSpecs = (rule.specificationValues || {}) as Record<string, unknown>;
                for (const [slug, val] of Object.entries(ruleSpecs)) {
                    if (normalize(specs[slug]) !== normalize(val)) return false;
                }
                return true;
            })
            .map((rule) => rule.id);
    }, [pending, categoryAddons]);

    const pricingHook = useCalculatePricing(
        {
            categoryId: category?.id ?? "",
            selectedSpecifications: (pending?.specifications ?? {}) as Record<string, string>,
            selectedAddons: computedSelectedAddons,
            files: pricingFiles,
            copies: pending?.copies && pending.copies > 0 ? pending.copies : 1,
        },
        {
            enabled: pending?.type === "service" && Boolean(category?.id),
            source: "guest-cart",
        },
    );

    // Server-authoritative price with a graceful fallback to the cached
    // total saved at add-to-cart time (handles initial render / offline).
    // Use a single explicit return shape so TS can `.breakdown` into the
    // addon list without union narrowing dropping the optional field.
    interface PriceBreakdownAddon {
        ruleId: string;
        name: string;
        total: number;
        breakdown?: AddonBreakdownEntry[];
    }
    /**
     * Read the snapshot price breakdown that the services page wrote at
     * add-to-cart time. Used both as the initial fallback (api in flight)
     * AND as the defensive fallback when the api response clearly mis-
     * attributes the split (addons=[] but cache says otherwise).
     *
     * Returns null when the snapshot is unusable (no breakdown rows /
     * zero-total) so callers can decide between "show cached" and
     * "show api". Centralised here so the two fallback paths can't drift.
     */
    type CachedBreakdown = {
        baseTotal: number;
        addonTotal: number;
        total: number;
    } | null;
    const readCachedBreakdown = (
        data: PendingPurchaseData | null,
    ): CachedBreakdown => {
        if (!data) return null;
        const rows = data.metadata?.priceBreakdown;
        if (!rows || rows.length === 0) return null;
        let base = 0;
        let addons = 0;
        for (const row of rows) {
            const label = String(row.label || "").toLowerCase();
            const value = Number(row.value || 0);
            if (!Number.isFinite(value)) continue;
            if (label.startsWith("base")) {
                base += value;
            } else {
                addons += value;
            }
        }
        const total = base + addons;
        if (total <= 0) return null;
        return { baseTotal: base, addonTotal: addons, total };
    };

    const priceBreakdown = useMemo<{
        baseTotal: number;
        addonTotal: number;
        total: number;
        addons: PriceBreakdownAddon[];
    }>(() => {
        const live = pricingHook.data;
        if (live) {
            // Defensive guard: if the api total is dramatically lower than
            // the price the user saw at add-to-cart time (e.g. < 10% of
            // the cached total), something is off — a stale spec ID, an
            // admin rule that changed mid-session, or a payload mismatch.
            const cached = Number(pending?.totalPrice || pending?.currentPrice || 0);
            if (cached > 0 && live.total > 0 && live.total < cached * 0.1) {
                console.warn(
                    "[GuestCart] live pricing < 10% of cached — using cached.",
                    {
                        live: { total: live.total, base: live.baseSubtotal, addons: live.addonsSubtotal, addonCount: live.addons.length },
                        cached,
                        payload: {
                            specs: pending?.specifications,
                            addonIds: pending?.selectedAddons,
                            fileCount: pending?.files?.length,
                            pageCount: pending?.pageCount,
                        },
                    },
                );
                return {
                    baseTotal: cached,
                    addonTotal: 0,
                    total: cached,
                    addons: [] as PriceBreakdownAddon[],
                };
            }

            // ── Defensive UI fallback for the issue-#93 collapse symptom ──
            // The api response landed with `addons=[]` and a high
            // baseTotal that equals the live total — BUT the snapshot
            // breakdown saved at add-to-cart time has addon rows summing
            // to >0 AND the same overall total (within ₹1). That's the
            // exact "flash correct split then collapse to base=total"
            // user report: the api response is wrong in attribution but
            // right on the bottom line, so we prefer the cached split
            // until the root cause is fixed in the engine.
            //
            // We intentionally only flip on a TOTAL match (±₹1) so a
            // genuine pricing change between add-to-cart and now (admin
            // edited the rule, user opened the cart a day later) still
            // surfaces the new number rather than a stale cached one.
            //
            // Greppable log: `[GuestCart] live addons=[] but cached has addons`.
            const cachedSplit = readCachedBreakdown(pending);
            const expectedAddonCount = computedSelectedAddons.length;
            const liveTotal = Number(live.total) || 0;
            const cachedTotal = cachedSplit?.total ?? 0;
            const totalsMatch =
                cachedTotal > 0 && liveTotal > 0 && Math.abs(liveTotal - cachedTotal) <= 1;
            const cacheHasAddons =
                cachedSplit !== null && cachedSplit.addonTotal > 0;
            if (
                expectedAddonCount > 0 &&
                live.addons.length === 0 &&
                cacheHasAddons &&
                totalsMatch
            ) {
                console.warn(
                    "[GuestCart] live addons=[] but cached has addons; using cached split",
                    {
                        live: {
                            total: liveTotal,
                            base: live.baseSubtotal,
                            addonsSubtotal: live.addonsSubtotal,
                            addonCount: live.addons.length,
                        },
                        cached: {
                            base: cachedSplit!.baseTotal,
                            addons: cachedSplit!.addonTotal,
                            total: cachedSplit!.total,
                        },
                        payload: {
                            categoryId: category?.id,
                            specs: pending?.specifications,
                            storedAddonIds:
                                pending?.selectedAddons ||
                                pending?.metadata?.selectedAddons ||
                                [],
                            computedAddonIds: computedSelectedAddons,
                            fileCount: pending?.files?.length,
                            pageCount: pending?.pageCount,
                            copies: pending?.copies,
                        },
                    },
                );
                return {
                    baseTotal: cachedSplit!.baseTotal,
                    addonTotal: cachedSplit!.addonTotal,
                    total: cachedSplit!.total,
                    addons: [] as PriceBreakdownAddon[],
                };
            }

            // Diagnostic: customer had selected N addons, api returned 0.
            // Surfaces stale rule IDs or post-add-to-cart spec drift.
            // Logs the full payload so the next prod report has the data
            // we need to find the underlying mismatch. Now also surfaces
            // any divergence between the snapshot ids and the recomputed
            // live ids (issue #93 — the snapshot may omit perFile rules).
            if (expectedAddonCount > 0 && live.addons.length === 0) {
                const stored =
                    pending?.selectedAddons || pending?.metadata?.selectedAddons || [];
                console.warn(
                    "[GuestCart] expected addons but api returned none.",
                    {
                        live: {
                            total: live.total,
                            base: live.baseSubtotal,
                            addonsSubtotal: live.addonsSubtotal,
                            hasHalfPageAdjustment: live.hasHalfPageAdjustment,
                            effectivePageCount: live.effectivePageCount,
                        },
                        payload: {
                            categoryId: category?.id,
                            specs: pending?.specifications,
                            storedAddonIds: stored,
                            computedAddonIds: computedSelectedAddons,
                            fileCount: pending?.files?.length,
                            pageCount: pending?.pageCount,
                            copies: pending?.copies,
                        },
                    },
                );
            }
            return {
                baseTotal: live.baseSubtotal,
                addonTotal: live.addonsSubtotal,
                total: live.total,
                addons: live.addons,
            };
        }
        if (pending) {
            const cachedSplit = readCachedBreakdown(pending);
            if (cachedSplit) {
                return {
                    baseTotal: cachedSplit.baseTotal,
                    addonTotal: cachedSplit.addonTotal,
                    total: cachedSplit.total,
                    addons: [] as PriceBreakdownAddon[],
                };
            }
            const total = Number(pending.totalPrice || pending.currentPrice || 0);
            return {
                baseTotal: total,
                addonTotal: 0,
                total,
                addons: [] as PriceBreakdownAddon[],
            };
        }
        return {
            baseTotal: 0,
            addonTotal: 0,
            total: 0,
            addons: [] as PriceBreakdownAddon[],
        };
    }, [pricingHook.data, pending, category?.id, computedSelectedAddons]);

    // Fallback labels — when the hook hasn't returned yet but we have stored
    // selectedAddons + category addon rules cached, surface the names so the
    // row doesn't pop in once pricing lands. Prefer the live-recomputed id set
    // (matches what the pricing call actually sends) and fall back to the
    // snapshot when live addons haven't loaded yet.
    const fallbackAddonNames = useMemo(() => {
        if (!pending) return [] as string[];
        const ids = computedSelectedAddons.length > 0
            ? computedSelectedAddons
            : (pending.selectedAddons || pending.metadata?.selectedAddons || []);
        if (ids.length === 0) return [];
        const byId = new Map(categoryAddons.map((a) => [a.id, a]));
        return ids
            .map((id) => byId.get(id))
            .filter((a): a is CategoryAddon => !!a)
            .map((a) => {
                const specs = (a.specificationValues || {}) as Record<string, unknown>;
                const entries = Object.entries(specs);
                if (entries.length === 0) return "Addon";
                return entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ");
            });
    }, [pending, categoryAddons, computedSelectedAddons]);

    // Wait for hydration so we don't flash "empty cart" before sessionStorage is read.
    if (!hydrated) return null;

    if (!pending) {
        return <EmptyGuestCart />;
    }

    // Compact metadata line: "1 copy · 482 pages · 241 effective (Both Sides)".
    const pendingPageCount = pending.pageCount;
    const pendingCopies = pending.copies;
    const pendingEffective = pending.metadata?.effectivePageCount;
    const pendingHasHalfPage = !!pending.metadata?.hasHalfPageAdjustment;
    const metaParts: string[] = [];
    if (pendingCopies) metaParts.push(`${pendingCopies} ${pendingCopies === 1 ? "copy" : "copies"}`);
    if (pendingPageCount) metaParts.push(`${pendingPageCount} page${pendingPageCount === 1 ? "" : "s"}`);
    const metaLine = metaParts.join(" · ");
    const halfPageNote =
        pendingHasHalfPage && pendingEffective && pendingPageCount && pendingEffective !== pendingPageCount
            ? `${pendingEffective} effective (Both Sides)`
            : null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Left column — pending item (compact card matching CartItem). */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                        {/* Image */}
                        <div className="shrink-0">
                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                                {displayImage ? (
                                    <Image
                                        src={displayImage}
                                        alt={title}
                                        fill
                                        className="object-cover"
                                        sizes="96px"
                                        loader={imageLoader}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ShoppingCart className="w-7 h-7" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                            {/* Title row + delete */}
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm sm:text-base text-gray-900 leading-snug truncate">
                                        {loadingDetails && !title ? "Loading…" : title}
                                    </h3>
                                    {(metaLine || halfPageNote || subtitle) && (
                                        <p className="mt-0.5 text-xs text-gray-500 truncate">
                                            {metaLine || subtitle}
                                            {halfPageNote && (
                                                <>
                                                    {(metaLine || subtitle) ? " · " : ""}
                                                    <span className="text-blue-600">{halfPageNote}</span>
                                                </>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={handleRemove}
                                    className="shrink-0 text-gray-400 hover:text-red-600 transition-colors p-1 -m-1 rounded"
                                    aria-label="Remove from cart"
                                    type="button"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Spec chips — kept tight (1 row, no padding bg) */}
                            {specChips.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {specChips.map((chip) => (
                                        <span
                                            key={`${chip.label}-${chip.value}`}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700"
                                        >
                                            <span className="text-gray-500">{chip.label}:</span>{" "}
                                            <span className="font-medium">{chip.value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Uploaded file rows */}
                            {fileChips.length > 0 && (
                                <div className="mt-2.5">
                                    <p className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                                        Uploaded files ({fileChips.length})
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {fileChips.slice(0, 6).map((file, idx) => (
                                            <UploadedFileTile
                                                key={`${file.name}-${idx}`}
                                                name={file.name}
                                                url={file.fileUrl}
                                            />
                                        ))}
                                    </div>
                                    {fileChips.length > 6 && (
                                        <p className="mt-1 text-[11px] text-gray-500">
                                            +{fileChips.length - 6} more file{fileChips.length - 6 === 1 ? "" : "s"}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Template form data (rare for guest) */}
                            {pending.templateId && pending.templateFormData && Object.keys(pending.templateFormData).length > 0 && (
                                <div className="mt-2.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                                    <p className="text-[11px] font-semibold text-amber-800 mb-1 uppercase tracking-wide flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Template form
                                    </p>
                                    <div className="space-y-0.5">
                                        {Object.entries(pending.templateFormData).map(([key, value]) => (
                                            <div key={key} className="flex justify-between gap-2 text-xs text-amber-800">
                                                <span className="text-amber-700 truncate">{key}</span>
                                                <span className="font-medium truncate text-right">
                                                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Price row */}
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-end justify-between gap-3">
                                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 min-w-0">
                                    <span>
                                        Base{" "}
                                        <span className="font-medium text-gray-900">
                                            {formatPrice(priceBreakdown.baseTotal)}
                                        </span>
                                    </span>
                                    {priceBreakdown.addonTotal > 0 && (
                                        <span>
                                            Addons{" "}
                                            <span className="font-medium text-gray-900">
                                                {formatPrice(priceBreakdown.addonTotal)}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Total</div>
                                    <div className="text-base sm:text-lg font-bold text-blue-600 leading-none">
                                        {formatPrice(priceBreakdown.total)}
                                    </div>
                                </div>
                            </div>

                            {/* Per-addon list — prefer server-computed totals
                                (Phase 1). Fallback only renders while the
                                api call is in flight (initial load); once the
                                api has responded we trust its view, including
                                an empty addon list. Otherwise stale
                                `pending.selectedAddons` ids would show
                                duplicate "paper-sizes: a4, …" labels with no
                                prices, which looks worse than rendering
                                nothing. */}
                            {priceBreakdown.addons.length > 0 ? (() => {
                                const labels = buildAddonLabelMap(priceBreakdown.addons);
                                return (
                                <ul className="mt-1.5 space-y-1">
                                    {priceBreakdown.addons.map((addon) => (
                                        <li key={addon.ruleId} className="text-[11px] text-gray-500">
                                            <div>
                                                <span className="text-gray-600">{labels.get(addon.ruleId) ?? addon.name}</span>
                                                {addon.total > 0 && (
                                                    <span className="font-medium text-gray-700"> {formatPrice(addon.total)}</span>
                                                )}
                                            </div>
                                            {addon.breakdown && addon.breakdown.length > 1 && (
                                                <AddonBreakdownRows
                                                    breakdown={addon.breakdown}
                                                    resolveFilename={resolveFilename}
                                                    variant="compact"
                                                />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                );
                            })() : pricingHook.isFetched && computedSelectedAddons.length > 0 ? (
                                <p className="mt-1.5 text-[11px] text-amber-600">
                                    None of your selected addons fit the current page count.
                                    Update files or re-add the item.
                                </p>
                            ) : pricingHook.isLoading && fallbackAddonNames.length > 0 ? (() => {
                                // Dedupe while loading so a single name only
                                // renders once even if multiple addon ids share it.
                                const unique = Array.from(new Set(fallbackAddonNames));
                                return (
                                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                    {unique.map((name, idx) => (
                                        <li key={`${name}-${idx}`} className="text-[11px] text-gray-400 italic">
                                            <span>{name}</span>
                                        </li>
                                    ))}
                                </ul>
                                );
                            })() : null}
                        </div>
                    </div>
                </div>

                <p className="mt-2 text-[11px] text-gray-500">
                    Saved on this device · log in at checkout to pay.
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
