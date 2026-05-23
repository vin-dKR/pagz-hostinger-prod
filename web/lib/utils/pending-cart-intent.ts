import { addToCart, verifyCartFiles, type AddToCartData, type VerifyFileInvalidEntry } from "@/lib/api/cart";
import { getCategoryAddons, getProductsBySpecifications } from "@/lib/api/categories";
import { getProduct } from "@/lib/api/products";
import { getAuthToken } from "@/lib/api-client";
import { uploadOrderFilesToS3 } from "@/lib/api/uploads";
import {
    clearPendingPurchaseData,
    getPendingPurchaseData,
    restoreFilesFromPendingData,
    savePendingPurchaseData,
    type PendingPurchaseData,
    type PendingPurchaseFile,
} from "@/lib/utils/pending-purchase";
import { describeVerifyReason } from "@/lib/utils/cart-file-sweep";

export const ADD_TO_CART_INTENT = "add_to_cart" as const;
const AUTH_WAIT_MAX_MS = 3000;
const AUTH_WAIT_STEP_MS = 100;
const ADD_TO_CART_MAX_RETRIES = 3;

type PendingCartIntentResult = {
    handled: boolean;
    success: boolean;
    error?: string;
    /** Per-file failure detail surfaced by the merge banner. Only set
     *  when the failure was caused by FTP verify rejecting a file the
     *  user had previously uploaded as a guest — distinct from
     *  generic add-to-cart errors which surface via `error`. */
    fileFailures?: Array<{ name: string; reason: VerifyFileInvalidEntry['reason'] }>;
};

type PendingCartMetadata = Record<string, any>;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAuthToken(maxWaitMs = AUTH_WAIT_MAX_MS): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
        if (getAuthToken()) return true;
        await sleep(AUTH_WAIT_STEP_MS);
    }
    return !!getAuthToken();
}

function getSelectedAddons(pendingData: PendingPurchaseData): string[] {
    return pendingData.selectedAddons || pendingData.metadata?.selectedAddons || [];
}

/**
 * Filter addon ids against the category's live ADDON rules. Stale ids (rules
 * deleted / deactivated between save and login) would otherwise make the
 * server's Prisma `connect` throw P2025 and reject the whole add-to-cart,
 * leaving the user with an empty cart post-login. Dropping bad ids lets the
 * item land with whatever addons are still valid.
 */
async function validateAddonIdsForCategory(
    categorySlug: string | undefined,
    ids: string[]
): Promise<string[]> {
    if (!categorySlug || ids.length === 0) return ids;
    try {
        const liveAddons = await getCategoryAddons(categorySlug);
        const liveSet = new Set(liveAddons.map((a) => a.id));
        const kept = ids.filter((id) => liveSet.has(id));
        if (kept.length !== ids.length) {
            console.warn(
                `[pending-cart-intent] dropped ${ids.length - kept.length}/${ids.length} stale addon id(s) for category ${categorySlug}`
            );
        }
        return kept;
    } catch (err) {
        // If we can't fetch live addons, proceed with the saved ids — a 404
        // on an addon is a clearer error than a blanket skip.
        console.warn("[pending-cart-intent] failed to validate addons; sending as-is:", err);
        return ids;
    }
}

function buildMetadata(pendingData: PendingPurchaseData): PendingCartMetadata | undefined {
    const metadata: PendingCartMetadata = {
        ...(pendingData.metadata || {}),
    };

    if (pendingData.pageCount !== undefined && metadata.pageCount === undefined) {
        metadata.pageCount = pendingData.pageCount;
    }
    if (pendingData.copies !== undefined && metadata.copies === undefined) {
        metadata.copies = pendingData.copies;
    }
    if (pendingData.templateId && !metadata.templateId) {
        metadata.templateId = pendingData.templateId;
    }
    if (pendingData.templateFormData && !metadata.templateFormData) {
        metadata.templateFormData = pendingData.templateFormData;
    }
    if (pendingData.templateFormImages && !metadata.templateFormImages) {
        metadata.templateFormImages = pendingData.templateFormImages;
    }

    // Carry the user-selected specs into cart metadata so the server can
    // re-derive half-page (and any other option-driven rules) without
    // trusting client `effectivePageCount` / `hasHalfPageAdjustment`.
    if (pendingData.specifications && !metadata.specifications) {
        metadata.specifications = pendingData.specifications;
    }

    const selectedAddons = getSelectedAddons(pendingData);
    if (selectedAddons.length > 0 && !metadata.selectedAddons) {
        metadata.selectedAddons = selectedAddons;
    }

    if (pendingData.fileHasPassword !== undefined && metadata.fileHasPassword === undefined) {
        metadata.fileHasPassword = pendingData.fileHasPassword;
    }
    if (pendingData.filePassword && metadata.filePassword === undefined) {
        metadata.filePassword = pendingData.filePassword;
    }

    // Phase 0 — forward per-file `{ url, pageCount }` from the guest entry
    // so the server persists `CartItem.metadata.files`. Legacy entries
    // without `metadata.files` flow through with the field omitted (the
    // server keeps the engine's aggregate path for those rows).
    const pendingFilesMeta = pendingData.metadata?.files;
    if (Array.isArray(pendingFilesMeta) && pendingFilesMeta.length > 0 && metadata.files === undefined) {
        metadata.files = pendingFilesMeta;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Thrown by `ensureUploadedFileKeys` when one or more files the guest had
 * previously uploaded came back invalid from FTP verify. Carries the
 * structured per-file detail so the banner can render filename + reason
 * instead of a generic "couldn't restore" string (issue #87).
 *
 * `partial` is set when SOME files were valid — the caller can choose to
 * keep the pending entry around (Retry / Discard banner) so the user
 * doesn't lose the rest of their selections.
 */
class PendingFileVerifyError extends Error {
    readonly failures: Array<{
        name: string;
        path: string;
        reason: VerifyFileInvalidEntry['reason'];
    }>;
    readonly validKeys: string[];

    constructor(
        failures: Array<{ name: string; path: string; reason: VerifyFileInvalidEntry['reason'] }>,
        validKeys: string[],
    ) {
        const summary = failures
            .map((f) => `${f.name}: ${describeVerifyReason(f.reason)}`)
            .join('; ');
        super(`Couldn't restore your previous file(s) — ${summary}`);
        this.name = 'PendingFileVerifyError';
        this.failures = failures;
        this.validKeys = validKeys;
    }
}

/** Public re-export so the banner code can downcast and pull `.failures`. */
export { PendingFileVerifyError };

function fileNameFromPath(pathOrUrl: string): string {
    const trimmed = pathOrUrl.trim();
    if (!trimmed) return 'file';
    const cleaned = trimmed.split('?')[0]!.split('#')[0]!;
    const segments = cleaned.split('/').filter(Boolean);
    return segments[segments.length - 1] || cleaned;
}

/**
 * Reasons that REALLY mean "this file is no good — block the restore and
 * surface a per-file banner row". Anything outside this set (notably
 * `unreadable`, network errors, unknown reasons) is treated as transient:
 * we trust the stored key, let it flow into the cart, and let the
 * cart-page on-mount sweep (issue #56) and the checkout-page pre-payment
 * guard re-verify with the proper auth + connection state.
 *
 * Why this split exists (issue #94):
 *   The post-login restore path was failing closed on transient FTP
 *   verify errors — Hostinger's FTP control channel intermittently
 *   reports `unreadable` for files that are demonstrably present at the
 *   right byte count moments later. The cart-restore banner then said
 *   "Couldn't restore your previous cart" for a perfectly valid file
 *   and the user was stuck. PR #90's two-pass retry server-side helped
 *   but didn't eliminate the race. The right invariant is: only block
 *   on deterministic failures (empty / missing); everything else is
 *   noise the downstream guards already handle.
 */
const HARD_FAIL_VERIFY_REASONS: ReadonlySet<VerifyFileInvalidEntry['reason']> = new Set([
    'empty',
    'missing',
]);

function isHardFailReason(reason: VerifyFileInvalidEntry['reason']): boolean {
    return HARD_FAIL_VERIFY_REASONS.has(reason);
}

/**
 * Resolve every guest-pending file to a server-side FTP key suitable for
 * `POST /cart`.
 *
 *  1. Files that already carry an `s3Key` (a relative FTP path stored
 *     during the guest upload) are verified against the FTP server. A
 *     fresh upload would re-send the restored 0-byte `File` blob — the
 *     server's `rejectEmptyFiles` multer guard then rejects the whole
 *     batch as "Empty file(s) detected", which was the user-visible
 *     symptom in issue #87. We skip the re-upload entirely when the
 *     existing key is valid on FTP.
 *
 *  2. Files without an `s3Key` (legacy entries or sessionStorage drops
 *     that kept only base64/blobUrl) are restored from the cached
 *     payload and uploaded fresh. The earlier guard wouldn't reach this
 *     branch for empty restored blobs because of (1).
 *
 *  3. ONLY `empty`/`missing` verify failures abort the restore and
 *     surface a `PendingFileVerifyError`. Transient reasons
 *     (`unreadable`, network, unknown) are treated as valid — the file
 *     is trusted into the cart and the cart-page sweep + payment guard
 *     act as the safety net. See `HARD_FAIL_VERIFY_REASONS` above for
 *     the full rationale (issue #94).
 */
async function ensureUploadedFileKeys(pendingData: PendingPurchaseData): Promise<string[]> {
    if (!pendingData.files || pendingData.files.length === 0) return [];

    const filesWithKeys: PendingPurchaseFile[] = pendingData.files.filter((f) => Boolean(f.s3Key));
    const filesWithoutKeys: PendingPurchaseFile[] = pendingData.files.filter((f) => !f.s3Key);

    // ── Step 1: verify already-uploaded files still exist on FTP ───────────
    let invalidByKey = new Map<string, VerifyFileInvalidEntry['reason']>();
    if (filesWithKeys.length > 0) {
        const paths = filesWithKeys.map((f) => f.s3Key!).filter(Boolean);
        try {
            const response = await verifyCartFiles(paths);
            if (response.success && response.data) {
                invalidByKey = new Map(
                    response.data.invalid.map((entry) => [entry.path, entry.reason]),
                );
            }
            // If verify itself failed (transport error etc.) we fall
            // through and trust the stored keys. The server-side payment
            // guard re-verifies before charging, so a transient verify
            // outage cannot cause us to ship bad files into checkout —
            // it would only delay the failure by one screen.
        } catch (error) {
            console.warn('[pending-cart-intent] file verify failed; trusting stored keys:', error);
        }
    }

    const failures: Array<{ name: string; path: string; reason: VerifyFileInvalidEntry['reason'] }> = [];
    const validKeys: string[] = [];
    let transientCount = 0;

    for (const file of filesWithKeys) {
        const key = file.s3Key!;
        const reason = invalidByKey.get(key);
        if (reason && isHardFailReason(reason)) {
            // Real, deterministic failure — block the restore.
            failures.push({
                name: file.name || fileNameFromPath(key),
                path: key,
                reason,
            });
            continue;
        }
        if (reason) {
            // Transient (`unreadable` / unknown). Trust the key into the
            // cart so the user isn't blocked by a network blip — the
            // cart-page sweep will re-verify once we're on /cart with the
            // proper connection state.
            transientCount++;
            console.info(
                `[pending-cart-intent] verify returned transient "${reason}" for ` +
                `"${file.name || fileNameFromPath(key)}"; trusting key for restore (issue #94)`,
            );
        }
        validKeys.push(key);
    }

    if (transientCount > 0) {
        console.info(
            `[pending-cart-intent] restored ${transientCount} file(s) with transient verify ` +
            `errors; cart-page sweep will re-check`,
        );
    }

    // ── Step 2: upload the files that don't have a key yet ─────────────────
    const newlyUploadedKeys: string[] = [];
    if (filesWithoutKeys.length > 0) {
        const restoredFiles = await restoreFilesFromPendingData(filesWithoutKeys);
        for (let i = 0; i < restoredFiles.length; i++) {
            const file = restoredFiles[i]!;
            const meta = filesWithoutKeys[i]!;

            // Defence-in-depth: never POST a 0-byte multipart body — the
            // server's `rejectEmptyFiles` middleware would reject the
            // whole batch and our error message would lose the filename
            // context. We classify this as `missing` (file content not
            // available locally to re-upload) so the banner says
            // "File not found on server" — accurate from the user's POV.
            if (!file || file.size === 0) {
                failures.push({
                    name: meta.name || file?.name || 'file',
                    path: meta.s3Key || meta.name || 'file',
                    reason: 'missing',
                });
                continue;
            }

            try {
                const response = await uploadOrderFilesToS3([file]);
                const key = response.data?.files?.[0]?.key;
                if (!response.success || !key) {
                    failures.push({
                        name: meta.name || file.name,
                        path: meta.s3Key || meta.name || file.name,
                        reason: 'unreadable',
                    });
                    continue;
                }
                newlyUploadedKeys.push(key);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`[pending-cart-intent] re-upload of "${meta.name}" failed: ${message}`);
                failures.push({
                    name: meta.name || file.name,
                    path: meta.s3Key || meta.name || file.name,
                    reason: 'unreadable',
                });
            }
        }
    }

    // ── Step 3: failure surface + persistence ──────────────────────────────
    if (failures.length > 0) {
        // Don't strip failures from the pending entry silently — the
        // banner asks the user (Retry / Discard) and we want a fresh
        // chance on retry. We DO mirror the newly-uploaded keys back to
        // sessionStorage so a Retry doesn't double-upload.
        if (newlyUploadedKeys.length > 0) {
            let uploadIndex = 0;
            const updatedFiles = pendingData.files.map<PendingPurchaseFile>((file) => {
                if (file.s3Key) return file;
                const key = newlyUploadedKeys[uploadIndex++];
                return key ? { ...file, s3Key: key } : file;
            });
            try {
                await savePendingPurchaseData({ ...pendingData, files: updatedFiles });
            } catch (e) {
                console.warn('[pending-cart-intent] failed to persist partial uploads:', e);
            }
        }
        throw new PendingFileVerifyError(failures, [...validKeys, ...newlyUploadedKeys]);
    }

    // ── Step 4: success — persist any new keys and return the full list ────
    if (newlyUploadedKeys.length > 0) {
        let uploadIndex = 0;
        const updatedFiles = pendingData.files.map<PendingPurchaseFile>((file) => {
            if (file.s3Key) return file;
            const key = newlyUploadedKeys[uploadIndex++];
            return key ? { ...file, s3Key: key } : file;
        });
        await savePendingPurchaseData({ ...pendingData, files: updatedFiles });
    }

    return [...validKeys, ...newlyUploadedKeys];
}

/**
 * Secondary match used only when the service page didn't persist a
 * resolved productId in the pending data (e.g. legacy sessionStorage
 * entries from before that field was saved).
 *
 * Addon rules carry their own specificationValues (e.g. "binding:
 * Spiral Binding") which are metadata on top of the base product,
 * NOT part of what identifies the product itself. If we send
 * addon-only keys into getProductsBySpecifications the server's
 * combination lookup can't find a matching BASE_PRICE rule and
 * returns zero products.
 *
 * We explicitly avoid the "pick any product in the category" fallback
 * that used to live here — it silently substituted an unrelated
 * product (wrong paper size, wrong color, wildly different price)
 * which is worse than refusing the merge. When this helper returns
 * null the caller surfaces an error and the pending data is kept
 * so the user can retry.
 */
async function matchProductForService(
    categorySlug: string,
    specifications: Record<string, any>
): Promise<any | null> {
    const pickInStock = (list: any[]) =>
        list.find((p: any) => p?.id && (p.stock === undefined || p.stock > 0)) || list[0];

    // Strategy 1: exact-spec match.
    const first = await getProductsBySpecifications(categorySlug, specifications);
    if (first && first.length > 0) {
        return pickInStock(first);
    }

    // Strategy 2: drop any spec key referenced by an ADDON rule and retry.
    // Product-defining specs also appear in BASE_PRICE / COMBINATION rules
    // so dropping addon-covered keys is safe for the match even if the key
    // name collides.
    try {
        const addons = await getCategoryAddons(categorySlug);
        const addonKeys = new Set<string>();
        for (const rule of addons) {
            const values = (rule.specificationValues || {}) as Record<string, unknown>;
            Object.keys(values).forEach((k) => addonKeys.add(k));
        }

        if (addonKeys.size > 0) {
            const trimmed: Record<string, any> = { ...specifications };
            for (const key of addonKeys) {
                delete trimmed[key];
            }
            if (Object.keys(trimmed).length !== Object.keys(specifications).length) {
                const second = await getProductsBySpecifications(categorySlug, trimmed);
                if (second && second.length > 0) {
                    return pickInStock(second);
                }
            }
        }
    } catch {
        /* best-effort — fall through */
    }

    return null;
}

/**
 * Verify the snapshot productId saved at add-to-cart time still exists
 * and is published. Returns the product row on success, null when it's
 * been deleted/unpublished between save and login.
 */
async function resolveSavedProduct(productId: string): Promise<any | null> {
    try {
        const res = await getProduct(productId);
        if (res.success && res.data?.id) return res.data;
    } catch {
        /* treat as missing */
    }
    return null;
}

async function buildServiceCartPayload(pendingData: PendingPurchaseData): Promise<AddToCartData> {
    if (!pendingData.categorySlug || !pendingData.specifications) {
        throw new Error("Pending service data is incomplete.");
    }

    // Prefer the product id the service page already resolved at add-to-cart
    // time — it's the authoritative match and avoids re-running the brittle
    // spec-match server-side (addon-only spec keys + exact-match semantics
    // produce zero results and we'd land on an unrelated product).
    let matchingProduct: any = null;
    if (pendingData.productId) {
        matchingProduct = await resolveSavedProduct(pendingData.productId);
    }

    if (!matchingProduct?.id) {
        matchingProduct = await matchProductForService(
            pendingData.categorySlug,
            pendingData.specifications
        );
    }

    if (!matchingProduct?.id) {
        throw new Error("No matching service product found.");
    }

    const uploadedFileKeys = await ensureUploadedFileKeys(pendingData);
    const selectedAddons = await validateAddonIdsForCategory(
        pendingData.categorySlug,
        getSelectedAddons(pendingData)
    );

    return {
        productId: matchingProduct.id,
        quantity: pendingData.quantity || 1,
        customDesignUrl: uploadedFileKeys.length > 0 ? uploadedFileKeys : undefined,
        metadata: buildMetadata(pendingData),
        hasAddon: selectedAddons.length > 0,
        addons: selectedAddons.length > 0 ? selectedAddons : undefined,
    };
}

async function buildProductCartPayload(pendingData: PendingPurchaseData): Promise<AddToCartData> {
    if (!pendingData.productId) {
        throw new Error("Pending product data is incomplete.");
    }

    const uploadedFileKeys = await ensureUploadedFileKeys(pendingData);
    const selectedAddons = await validateAddonIdsForCategory(
        pendingData.categorySlug,
        getSelectedAddons(pendingData)
    );

    return {
        productId: pendingData.productId,
        variantId: pendingData.selectedVariant,
        quantity: pendingData.quantity || 1,
        customDesignUrl: uploadedFileKeys.length > 0 ? uploadedFileKeys : undefined,
        metadata: buildMetadata(pendingData),
        hasAddon: selectedAddons.length > 0,
        addons: selectedAddons.length > 0 ? selectedAddons : undefined,
    };
}

export async function processPendingAddToCartIntent(): Promise<PendingCartIntentResult> {
    const pendingData = getPendingPurchaseData();
    if (!pendingData) {
        return { handled: false, success: false };
    }

    try {
        // Wait briefly for post-login token propagation (cookie write + app state sync).
        await waitForAuthToken();

        let cartPayload: AddToCartData;
        try {
            cartPayload =
                pendingData.type === "service"
                    ? await buildServiceCartPayload(pendingData)
                    : await buildProductCartPayload(pendingData);
        } catch (error) {
            // File-verify failure: keep the pending entry in
            // sessionStorage so the banner can offer Retry / Discard.
            // We deliberately do NOT clearPendingPurchaseData here —
            // that was the silent-empty-cart bug in issue #87.
            if (error instanceof PendingFileVerifyError) {
                return {
                    handled: true,
                    success: false,
                    error: error.message,
                    fileFailures: error.failures.map((f) => ({
                        name: f.name,
                        reason: f.reason,
                    })),
                };
            }
            throw error;
        }

        let lastError = "Failed to add pending item to cart.";
        let addonsAlreadyStripped = false;

        for (let attempt = 0; attempt < ADD_TO_CART_MAX_RETRIES; attempt++) {
            try {
                const response = await addToCart(cartPayload);
                if (response.success) {
                    clearPendingPurchaseData();
                    return { handled: true, success: true };
                }

                lastError = response.error || response.message || lastError;
                const lowerError = lastError.toLowerCase();
                const isAddonIssue =
                    (lowerError.includes("addon") || lowerError.includes("foreign") || lowerError.includes("constraint") || lowerError.includes("not found") || lowerError.includes("p2025")) &&
                    !addonsAlreadyStripped &&
                    Boolean(cartPayload.addons && cartPayload.addons.length > 0);

                if (isAddonIssue) {
                    cartPayload = { ...cartPayload, addons: [], hasAddon: false };
                    addonsAlreadyStripped = true;
                    continue; // retry immediately without adding to attempt backoff
                }

                const shouldRetry =
                    lowerError.includes("token") ||
                    lowerError.includes("unauthorized") ||
                    lowerError.includes("network");

                if (!shouldRetry || attempt === ADD_TO_CART_MAX_RETRIES - 1) {
                    return { handled: true, success: false, error: lastError };
                }
            } catch (error) {
                lastError =
                    error instanceof Error ? error.message : "Failed to add pending item to cart.";
                const lowerError = lastError.toLowerCase();

                const isAddonIssue =
                    (lowerError.includes("addon") || lowerError.includes("foreign") || lowerError.includes("constraint") || lowerError.includes("not found") || lowerError.includes("p2025")) &&
                    !addonsAlreadyStripped &&
                    Boolean(cartPayload.addons && cartPayload.addons.length > 0);

                if (isAddonIssue) {
                    cartPayload = { ...cartPayload, addons: [], hasAddon: false };
                    addonsAlreadyStripped = true;
                    continue;
                }

                const shouldRetry =
                    lowerError.includes("token") ||
                    lowerError.includes("unauthorized") ||
                    lowerError.includes("network");

                if (!shouldRetry || attempt === ADD_TO_CART_MAX_RETRIES - 1) {
                    return { handled: true, success: false, error: lastError };
                }
            }

            await sleep(250 * (attempt + 1));
        }
        return { handled: true, success: false, error: lastError };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to process pending cart item.";
        return { handled: true, success: false, error: message };
    }
}

export async function savePendingProductForCartIntent(params: {
    productId: string;
    quantity?: number;
    selectedVariant?: string;
    metadata?: PendingPurchaseData["metadata"];
    returnUrl?: string;
}): Promise<void> {
    const returnUrl =
        params.returnUrl ||
        (typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/");

    await savePendingPurchaseData({
        type: "product",
        productId: params.productId,
        selectedVariant: params.selectedVariant,
        quantity: params.quantity || 1,
        files: [],
        metadata: params.metadata,
        timestamp: Date.now(),
        returnUrl,
    });
}
