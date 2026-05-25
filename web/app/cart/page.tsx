"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "../components/Breadcrumbs";
import CartItem from "../components/CartItem";
import BillingSummary from "../components/BillingSummary";
import GuestCart from "../components/GuestCart";
import PendingMergeBanner from "../components/PendingMergeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import toast from "react-hot-toast";
import { toastError, toastWarning } from "@/lib/utils/toast";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { uploadOneFile } from "@/lib/api/uploads";
import { isAbortError } from "@/lib/api/ftp";
import { updateCartItem } from "@/lib/api/cart";
import { redirectGuestToLoginForCheckout } from "@/lib/utils/guest-cart";
import {
    computeCategoryShortfalls,
    formatInr,
} from "@/lib/utils/category-min-cart-value";
import {
    sweepCartFiles,
    formatInvalidFilesMessage,
} from "@/lib/utils/cart-file-sweep";

function CartPageContent() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const {
        cart,
        items,
        loading,
        error,
        updatingItemId,
        removingItemId,
        total,
        updateQuantity,
        removeItem,
        refetch,
    } = useCart();

    const { confirm, ConfirmDialog } = useConfirm();
    const router = useRouter();

    // Selection state - track which items are selected
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    // Track which item is currently uploading images
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
    // Track if we've initialized selection (to prevent re-selecting after unselect all)
    const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
    // #56 retroactive sweep: items that lost ALL their files because every
    // attached file came back invalid from the FTP verify. We block
    // checkout for these rows and surface an inline error per row.
    const [itemsMissingFiles, setItemsMissingFiles] = useState<Set<string>>(new Set());
    // Tracks the (latest) cart signature we have already swept so we don't
    // re-run the FTP probe on every cart context update. Signature = sorted
    // item id + file count to refresh after upload / remove.
    const [lastSweepKey, setLastSweepKey] = useState<string | null>(null);
    // Issue #94 — when the initial sweep returns transient (`unreadable`)
    // failures, schedule ONE background retry 2s later. Hostinger's FTP
    // control channel occasionally hiccups under the load of a fresh
    // post-login session and the second attempt almost always succeeds.
    // Tracks per-signature so we don't retry forever on a permanently
    // flaky server.
    const [needsTransientRetry, setNeedsTransientRetry] = useState<string | null>(null);

    // Select all items by default on initial mount only
    useEffect(() => {
        if (items.length > 0 && !hasInitializedSelection && selectedItems.size === 0) {
            setSelectedItems(new Set(items.map(item => item.id)));
            setHasInitializedSelection(true);
        }
    }, [items, hasInitializedSelection, selectedItems.size]);

    // Retroactive 0KB sweep (issue #56). For every cart item with attached
    // design files we ask the API to confirm each FTP path still exists
    // with size > 0, then strip the bad paths from the cart row and toast
    // the user. The signature gate keeps this from re-running on every
    // cart-context refresh.
    useEffect(() => {
        if (authLoading || loading) return;
        if (!isAuthenticated) return;
        if (items.length === 0) return;

        // Signature = "id:fileCount" per row, sorted, so we re-sweep only
        // when the file composition changes (new upload, removed file).
        const signature = items
            .map((it) => {
                const urls = Array.isArray(it.customDesignUrl)
                    ? it.customDesignUrl
                    : it.customDesignUrl
                        ? [it.customDesignUrl]
                        : [];
                return `${it.id}:${urls.length}`;
            })
            .sort()
            .join('|');

        if (signature === lastSweepKey) return;

        let cancelled = false;
        (async () => {
            try {
                const result = await sweepCartFiles(items, true);
                if (cancelled) return;

                setLastSweepKey(signature);
                setItemsMissingFiles(new Set(result.itemsWithNoFilesLeft));

                // Partition the invalids: hard failures (empty / missing)
                // warrant the existing "removed N files" toast; transient
                // ones (unreadable / network) are silent here — the
                // background retry below will resolve them.
                const hardFailures = result.invalidEntries.filter(
                    (e) => e.reason === 'empty' || e.reason === 'missing',
                );
                const transientFailures = result.invalidEntries.filter(
                    (e) => e.reason !== 'empty' && e.reason !== 'missing',
                );

                if (hardFailures.length > 0) {
                    toastError(formatInvalidFilesMessage(hardFailures.length));
                }
                if (result.hadInvalid) {
                    // Pull the cleaned-up cart back so the UI mirrors the
                    // stripped customDesignUrl arrays.
                    await refetch();
                }
                // Schedule the one-shot retry for transient-only failures
                // so the user doesn't see a flicker of "missing files"
                // banner when the FTP probe just blipped (issue #94).
                if (transientFailures.length > 0) {
                    setNeedsTransientRetry(signature);
                } else {
                    setNeedsTransientRetry(null);
                }
            } catch (err) {
                // FTP verify is best-effort UX — if it fails, the
                // server-side payment guard still blocks bad orders.
                console.warn('[cart] file sweep failed:', err);
                if (!cancelled) {
                    setLastSweepKey(signature);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [authLoading, loading, isAuthenticated, items, lastSweepKey, refetch]);

    // Issue #94 — one-shot retry of the file sweep 2s after a transient
    // failure. We DON'T set `lastSweepKey` again here so this effect
    // fires exactly once per signature (cleared on success below). The
    // dependency list deliberately excludes `items` so a cart refetch
    // during the 2s window doesn't restart the timer.
    useEffect(() => {
        if (!needsTransientRetry) return;
        if (authLoading || loading) return;
        if (!isAuthenticated) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            if (cancelled) return;
            try {
                const result = await sweepCartFiles(items, true);
                if (cancelled) return;

                setItemsMissingFiles(new Set(result.itemsWithNoFilesLeft));

                const hardFailures = result.invalidEntries.filter(
                    (e) => e.reason === 'empty' || e.reason === 'missing',
                );
                if (hardFailures.length > 0) {
                    toastError(formatInvalidFilesMessage(hardFailures.length));
                }
                if (result.hadInvalid) {
                    await refetch();
                }
                // Whether the retry succeeded or still saw transient
                // errors, we don't retry again — the cart-context refetch
                // (via the user reloading / interacting) will reset
                // `lastSweepKey` if anything actually changes.
                setNeedsTransientRetry(null);
            } catch (err) {
                console.warn('[cart] transient-retry sweep failed:', err);
                if (!cancelled) setNeedsTransientRetry(null);
            }
        }, 2000);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsTransientRetry, authLoading, loading, isAuthenticated]);

    // Filter selected items
    const selectedItemsList = useMemo(() => {
        return items.filter(item => selectedItems.has(item.id));
    }, [items, selectedItems]);

    // Calculate MRP (Maximum Retail Price) for selected items only
    const mrp = useMemo(() => {
        return selectedItemsList.reduce((sum, item) => {
            const product = item.product as any;
            const mrpPrice = Number(product?.mrp || 0);
            return sum + mrpPrice * item.quantity;
        }, 0);
    }, [selectedItemsList]);

    // Calculate base & addon subtotals for selected items only
    const { baseSubtotal, addonsSubtotal, subtotal } = useMemo(() => {
        let base = 0;
        let addons = 0;

        for (const item of selectedItemsList as any[]) {
            if (item.pricing) {
                base += Number(item.pricing.baseTotal || 0);
                addons += Number(item.pricing.addonTotal || 0);
            } else {
                const price = Number(item.product?.sellingPrice || item.product?.basePrice || 0);
                const variantModifier = Number(item.variant?.priceModifier || 0);
                const itemPrice = price + variantModifier;
                base += itemPrice * item.quantity;
            }
        }

        return {
            baseSubtotal: base,
            addonsSubtotal: addons,
            subtotal: base + addons,
        };
    }, [selectedItemsList]);

    // Cart-level billing values (no extra discount/coupon on cart page)
    const discount = 0;
    const couponApplied = 0;
    const shippingFee = 0; // Same as checkout for now

    const grandTotal = useMemo(() => {
        return (subtotal || 0) + shippingFee;
    }, [subtotal, shippingFee]);


    const handleQuantityChange = async (id: string, quantity: number) => {
        if (quantity < 1) {
            return;
        }
        const success = await updateQuantity(id, quantity);
        if (!success) {
            toastError('Failed to update cart item. Please try again.');
        }
    };

    const handleRemoveItem = async (id: string) => {
        const confirmed = await confirm({
            title: 'Remove Item',
            description: 'Are you sure you want to remove this item from your cart?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                const success = await removeItem(id);
                if (!success) {
                    toastError('Failed to remove item from cart. Please try again.');
                } else {
                    // Remove from selection if it was selected
                    setSelectedItems(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }
            },
        });
    };

    const handleSelectChange = (id: string, selected: boolean) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(id);
            } else {
                // Allow unselecting all items (removed restriction)
                next.delete(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        // Always select all items
        setSelectedItems(new Set(items.map(item => item.id)));
    };

    const handleUnselectAll = () => {
        // Allow unselecting all items
        setSelectedItems(new Set());
    };

    // Helper function to check if item has images or template form data
    const itemHasImages = (item: typeof items[0]): boolean => {
        // Check for uploaded design files
        if (item.customDesignUrl) {
            if (Array.isArray(item.customDesignUrl)) {
                if (item.customDesignUrl.length > 0 &&
                    item.customDesignUrl.some(url => url && url.trim() !== '')) {
                    return true;
                }
            } else if (typeof item.customDesignUrl === 'string' &&
                item.customDesignUrl.trim() !== '') {
                return true;
            }
        }

        // Check for template with form data (template form data means files not required)
        if (item.metadata?.templateId) {
            // If template has form data, consider it as having "files" (form data replaces file requirement)
            if (item.metadata?.templateFormData && Object.keys(item.metadata.templateFormData).length > 0) {
                return true;
            }
            // Also check for template form images
            if (item.metadata?.templateFormImages && item.metadata.templateFormImages.length > 0) {
                return true;
            }
            // If template preview image exists, also consider it valid
            if (item.metadata?.templatePreviewImage) {
                return true;
            }
        }

        return false;
    };

    // Check if all selected items have images
    const allSelectedItemsHaveImages = useMemo(() => {
        if (selectedItemsList.length === 0) return false;

        return selectedItemsList.every(item => itemHasImages(item));
    }, [selectedItemsList]);

    // Any selected item whose files were all stripped by the #56 sweep
    // blocks checkout — the user must re-upload before continuing.
    const selectedItemsMissingFilesAfterSweep = useMemo(
        () => selectedItemsList.filter((item) => itemsMissingFiles.has(item.id)),
        [selectedItemsList, itemsMissingFiles],
    );
    const hasSweepBlockedItem = selectedItemsMissingFilesAfterSweep.length > 0;

    // Per-category minimum cart value check: blocks checkout when the total
    // for any category (across the *selected* items) falls below the
    // configured minimum. The API's /cart/validate-minimums endpoint (and
    // createOrder) is the authoritative check; this is the inline preview.
    const categoryShortfalls = useMemo(
        () => computeCategoryShortfalls(selectedItemsList),
        [selectedItemsList]
    );
    const hasCategoryShortfall = categoryShortfalls.length > 0;

    const handleGoToCheckout = () => {
        // If (somehow) a logged-out user reaches the server-cart checkout
        // button, defer to the guest login-and-checkout flow instead of
        // silently failing on the checkout page.
        if (!isAuthenticated) {
            redirectGuestToLoginForCheckout('/checkout');
            return;
        }

        if (selectedItems.size === 0) {
            toastWarning('Please select at least one item to checkout.');
            return;
        }

        // Check if all selected items have images
        const itemsWithoutImages = selectedItemsList.filter(item => !itemHasImages(item));

        if (itemsWithoutImages.length > 0) {
            const itemNames = itemsWithoutImages
                .map(item => item.product?.name || 'Unknown Product')
                .join(', ');

            toastError(
                `Please add design files for: ${itemNames}. ` +
                `You can upload images directly from the cart.`
            );

            // Optionally scroll to first item without images
            const firstItemId = itemsWithoutImages[0]?.id;
            if (firstItemId) {
                const element = document.getElementById(`cart-item-${firstItemId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            return;
        }

        // #56 retroactive sweep: even if the file *count* looks fine, the
        // sweep may have stripped every file because they were 0-byte /
        // missing on FTP. Block until the user re-uploads.
        if (hasSweepBlockedItem) {
            const names = selectedItemsMissingFilesAfterSweep
                .map((item) => item.product?.name || 'Unknown Product')
                .join(', ');
            toastError(
                `Please re-upload design files for: ${names}. The previously attached files were empty or missing.`,
            );
            const firstId = selectedItemsMissingFilesAfterSweep[0]?.id;
            if (firstId) {
                const el = document.getElementById(`cart-item-${firstId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Per-category minimum cart value: surface the most-constrained
        // categories up-front so the user knows exactly how much more to add.
        const firstShortfall = categoryShortfalls[0];
        if (firstShortfall) {
            const diff = Math.max(0, firstShortfall.required - firstShortfall.current);
            toastError(
                `Add ${formatInr(diff)} more to "${firstShortfall.categoryName}" to reach its minimum of ${formatInr(firstShortfall.required)}.`
            );
            return;
        }

        // All items have images, proceed to checkout
        const selectedIds = Array.from(selectedItems).join(',');
        router.push(`/checkout?items=${selectedIds}`);
    };

    // Image upload handler — serial, per-file progress (issue #58).
    //
    // Uploads files one-by-one via the XHR-based `uploadOneFile` util so the
    // toast can report `[2/5] design.pdf — 45%` mid-flight. A single bad file
    // no longer aborts the entire batch: it's logged, the loop continues, and
    // we update the cart with whatever made it through. If nothing succeeded
    // we surface a single error toast.
    const handleImageUpload = async (itemId: string, files: File[]) => {
        if (files.length === 0) return;

        setUploadingItemId(itemId);
        const toastId = toast.loading(`Uploading 0 / ${files.length}…`, { position: 'top-right' });

        // Issue #86 — dedupe BEFORE the network round-trip. The cart
        // row already carries every previously-uploaded URL; if the
        // user re-attaches the same file we want to leave the existing
        // URL alone instead of producing a second FTP entry that a
        // later sweep would happily delete (orphaning the OrderItem
        // snapshot that still references the original). We don't have
        // a `File` for the existing URLs (only the path), so we match
        // on the trailing filename embedded in the stored path. The
        // upload route prefixes each file with `<timestamp>-<uuid8>-`
        // so a true match on `…-<originalname>` is reliable enough for
        // the duplicate-click case the bug surfaced. Hashing would be
        // stronger but would require fetching the existing file from
        // FTP just to compare — far more expensive than the skipped
        // upload it would avoid.
        const cartItemForDedup = items.find((item) => item.id === itemId);
        const existingUrlsForDedup = cartItemForDedup
            ? Array.isArray(cartItemForDedup.customDesignUrl)
                ? cartItemForDedup.customDesignUrl
                : cartItemForDedup.customDesignUrl
                    ? [cartItemForDedup.customDesignUrl]
                    : []
            : [];
        const isAlreadyUploaded = (file: File): boolean => {
            // Mirror the backend's `sanitizeBaseName` substitution so
            // the substring match stays in lock-step with whatever the
            // upload route actually wrote into the stored URL.
            const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
            return existingUrlsForDedup.some((url) => {
                if (typeof url !== 'string') return false;
                // Stored as either full URL or relative path; substring
                // match on the trailing filename is enough.
                return url.includes(safeName);
            });
        };

        const filesToUpload: File[] = [];
        let dedupedCount = 0;
        for (const file of files) {
            if (isAlreadyUploaded(file)) {
                console.info('[cart] skipping duplicate upload (already on FTP):', file.name);
                dedupedCount++;
            } else {
                filesToUpload.push(file);
            }
        }
        if (dedupedCount > 0 && filesToUpload.length === 0) {
            // Every selected file is already attached — nothing to
            // upload, surface a friendly toast and skip the round-trip.
            toast.success('Already attached — no re-upload needed.', { id: toastId });
            setUploadingItemId(null);
            return;
        }

        const uploadedKeys: string[] = [];
        const failed: { name: string; error: string }[] = [];

        try {
            for (let i = 0; i < filesToUpload.length; i++) {
                const file = filesToUpload[i];
                if (!file) continue;

                const label = `[${i + 1}/${filesToUpload.length}] ${file.name}`;
                toast.loading(`${label} — 0%`, { id: toastId });

                try {
                    const result = await uploadOneFile(file, (e) => {
                        toast.loading(`${label} — ${e.percent}%`, { id: toastId });
                    });
                    uploadedKeys.push(result.key);
                } catch (err) {
                    if (isAbortError(err)) {
                        failed.push({ name: file.name, error: 'cancelled' });
                    } else {
                        const message = err instanceof Error ? err.message : 'Upload failed';
                        failed.push({ name: file.name, error: message });
                        console.error('[cart] file upload failed:', file.name, err);
                    }
                    // Per issue #58: continue with the remaining files.
                }
            }

            // Nothing made it through — surface the error and bail before
            // touching the cart row.
            if (uploadedKeys.length === 0) {
                toast.error('Failed to upload images. Please try again.', { id: toastId });
                return;
            }

            // Update cart with whatever succeeded. (HEAD's serial loop
            // already populated `uploadedKeys` and `failed`; the partial-
            // failure toast at the end of this handler surfaces both,
            // which gives the same UX as the batch-path failure surface
            // from issue #56.)
            toast.loading('Updating cart item…', { id: toastId });

            const cartItem = items.find((item) => item.id === itemId);
            if (!cartItem) {
                toast.error('Cart item not found.', { id: toastId });
                return;
            }

            const existingUrls = Array.isArray(cartItem.customDesignUrl)
                ? cartItem.customDesignUrl
                : cartItem.customDesignUrl
                    ? [cartItem.customDesignUrl]
                    : [];
            const allUrls = [...existingUrls, ...uploadedKeys];

            const updateResponse = await updateCartItem(itemId, {
                quantity: cartItem.quantity, // backend validation requires it
                customDesignUrl: allUrls,
            });

            if (!updateResponse.success) {
                toast.error('Failed to update cart item. Please try again.', { id: toastId });
                return;
            }

            await refetch();

            if (failed.length === 0) {
                // Issue #86 — toast also acknowledges silently-skipped
                // duplicate selections so the user understands why the
                // file count didn't grow.
                toast.success(
                    dedupedCount > 0
                        ? `Added ${uploadedKeys.length} file(s); ${dedupedCount} already attached.`
                        : 'Design files added successfully!',
                    { id: toastId },
                );
            } else {
                // Partial success — main toast resolves, then a follow-up
                // error toast lists the failures so the user can re-try.
                // `filesToUpload.length` is the post-dedupe denominator —
                // counting the skipped ones as failures would be
                // misleading because we never even tried to upload them.
                toast.success(
                    `Uploaded ${uploadedKeys.length} of ${filesToUpload.length} files.`,
                    { id: toastId },
                );
                toastError(
                    `Failed: ${failed.map((f) => f.name).join(', ')}. Please re-upload.`,
                );
            }
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error('Failed to upload images. Please try again.', { id: toastId });
        } finally {
            setUploadingItemId(null);
        }
    };

    const breadcrumbs = [
        { label: "Home", href: "/" },
        { label: "Cart", href: "/cart" },
    ];

    console.log("---debug addonsSubtotal in the cart", addonsSubtotal)

    return (
        <div className="min-h-screen py-4 sm:py-6 lg:py-8">
            {ConfirmDialog}
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumbs */}
                <Breadcrumbs items={breadcrumbs} />

                <h1 className="text-2xl sm:text-3xl font-hkgb font-bold text-gray-900 mb-4 sm:mb-6">YOUR CART</h1>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                        <p className="text-red-600 text-sm sm:text-base">{error}</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-2 text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium underline cursor-pointer"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Post-login: if the guest->user merge failed, surface it with a retry CTA
                    instead of silently showing an empty cart. */}
                {!authLoading && isAuthenticated && <PendingMergeBanner />}

                {/* Guest cart (logged-out users see their pending purchase) */}
                {!authLoading && !isAuthenticated ? (
                    <GuestCart />
                ) : (loading || authLoading) ? (
                    <div className="flex items-center justify-center py-12">
                        <BarsSpinner />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                        {/* Left Column - Cart Items */}
                        <div className="lg:col-span-2 order-2 lg:order-1">
                            {/* Select All / Unselect All */}
                            {items.length > 0 && (
                                <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-3 sm:p-4">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <button
                                            onClick={handleSelectAll}
                                            disabled={selectedItems.size === items.length}
                                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${selectedItems.size === items.length
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                }`}
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={handleUnselectAll}
                                            disabled={selectedItems.size === 0}
                                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${selectedItems.size === 0
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            Unselect All
                                        </button>
                                    </div>
                                    <span className="text-xs sm:text-sm text-gray-600 text-center sm:text-right">
                                        {selectedItems.size} of {items.length} items selected
                                    </span>
                                </div>
                            )}

                            {items.length === 0 ? (
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
                            ) : (
                                <div className="space-y-2.5 sm:space-y-3">
                                    {/* #56 retroactive sweep banner: list items whose previously
                                        attached files were stripped because they were 0-byte
                                        or missing on the FTP server. */}
                                    {hasSweepBlockedItem && (
                                        <div
                                            role="alert"
                                            className="rounded-xl sm:rounded-2xl border border-red-300 bg-red-50 p-3 sm:p-4 text-red-800"
                                        >
                                            <p className="text-sm font-semibold mb-1">
                                                Some uploaded files are missing or empty
                                            </p>
                                            <p className="text-xs sm:text-sm mb-2">
                                                Please re-upload design files for:
                                            </p>
                                            <ul className="space-y-1 text-xs sm:text-sm list-disc list-inside">
                                                {selectedItemsMissingFilesAfterSweep.map((it) => (
                                                    <li key={it.id}>
                                                        {it.product?.name || 'Unknown Product'}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {items.map((item) => (
                                        <CartItem
                                            key={item.id}
                                            item={item}
                                            onQuantityChange={handleQuantityChange}
                                            onRemove={handleRemoveItem}
                                            isUpdating={updatingItemId === item.id}
                                            isRemoving={removingItemId === item.id}
                                            isSelected={selectedItems.has(item.id)}
                                            onSelectChange={handleSelectChange}
                                            showCheckbox={true}
                                            isCheckboxDisabled={false}
                                            onImageUpload={handleImageUpload}
                                            isUploadingImages={uploadingItemId === item.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right Column - Billing Summary */}
                        {items.length > 0 && (
                            <div className="lg:col-span-1 order-1 lg:order-2">
                                <div className="sticky top-4">
                                    {hasCategoryShortfall && (
                                        <div
                                            role="alert"
                                            className="mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border border-amber-300 bg-amber-50 p-3 sm:p-4 text-amber-900"
                                        >
                                            <p className="text-sm font-semibold mb-2">
                                                Minimum order value not met
                                            </p>
                                            <ul className="space-y-1.5 text-xs sm:text-sm">
                                                {categoryShortfalls.map((s) => {
                                                    const diff = Math.max(0, s.required - s.current);
                                                    return (
                                                        <li key={s.categoryId}>
                                                            <span className="font-medium">{s.categoryName}</span>:{' '}
                                                            current {formatInr(s.current)} / required{' '}
                                                            {formatInr(s.required)}{' '}
                                                            <span className="text-amber-800">
                                                                (add {formatInr(diff)})
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                    <BillingSummary
                                        mrp={mrp || 0}
                                        subtotal={baseSubtotal || 0}
                                        addonsSubtotal={addonsSubtotal || 0}
                                        discount={discount}
                                        couponApplied={couponApplied}
                                        shipping={shippingFee}
                                        grandTotal={grandTotal}
                                        itemCount={selectedItemsList.length}
                                        showCheckoutActions={false}
                                        hideCouponAndShipping={true}
                                    />
                                    <button
                                        onClick={handleGoToCheckout}
                                        disabled={
                                            selectedItems.size === 0
                                            || !allSelectedItemsHaveImages
                                            || hasCategoryShortfall
                                            || hasSweepBlockedItem
                                        }
                                        className={`w-full mt-3 sm:mt-4 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base text-white transition-colors font-medium ${selectedItems.size > 0 && allSelectedItemsHaveImages && !hasCategoryShortfall && !hasSweepBlockedItem
                                            ? "bg-[#1EADD8] hover:bg-blue-700"
                                            : "bg-gray-400 cursor-not-allowed"
                                            }`}
                                    >
                                        {selectedItems.size === 0
                                            ? 'Select items to checkout'
                                            : !allSelectedItemsHaveImages
                                                ? 'Add images to all items'
                                                : hasCategoryShortfall
                                                    ? 'Minimum not met for some categories'
                                                    : hasSweepBlockedItem
                                                        ? 'Re-upload missing/empty files'
                                                        : `Go to Checkout (${selectedItemsList.length} ${selectedItemsList.length === 1 ? 'item' : 'items'})`
                                        }
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CartPage() {
    // Note: /cart is intentionally *not* wrapped in ProtectedRoute.
    // Logged-out users see their pending purchase via <GuestCart />;
    // the auth gate has moved to the Checkout button (see
    // `redirectGuestToLoginForCheckout`).
    return <CartPageContent />;
}
