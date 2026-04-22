import { addToCart, type AddToCartData } from "@/lib/api/cart";
import { getCategoryAddons, getProductsBySpecifications } from "@/lib/api/categories";
import { getProducts } from "@/lib/api/products";
import { getAuthToken } from "@/lib/api-client";
import { uploadOrderFilesToS3 } from "@/lib/api/uploads";
import {
    clearPendingPurchaseData,
    getPendingPurchaseData,
    restoreFilesFromPendingData,
    savePendingPurchaseData,
    type PendingPurchaseData,
} from "@/lib/utils/pending-purchase";

export const ADD_TO_CART_INTENT = "add_to_cart" as const;
const AUTH_WAIT_MAX_MS = 3000;
const AUTH_WAIT_STEP_MS = 100;
const ADD_TO_CART_MAX_RETRIES = 3;

type PendingCartIntentResult = {
    handled: boolean;
    success: boolean;
    error?: string;
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

    return Object.keys(metadata).length > 0 ? metadata : undefined;
}

async function ensureUploadedFileKeys(pendingData: PendingPurchaseData): Promise<string[]> {
    if (!pendingData.files || pendingData.files.length === 0) return [];

    const filesWithoutKeys = pendingData.files.filter((file) => !file.s3Key);
    if (filesWithoutKeys.length === 0) {
        return pendingData.files.map((file) => file.s3Key).filter(Boolean) as string[];
    }

    const restoredFiles = await restoreFilesFromPendingData(filesWithoutKeys);
    const uploadedKeys: string[] = [];

    for (const file of restoredFiles) {
        const response = await uploadOrderFilesToS3([file]);
        const key = response.data?.files?.[0]?.key;
        if (!response.success || !key) {
            throw new Error(response.error || `Failed to upload ${file.name}`);
        }
        uploadedKeys.push(key);
    }

    let uploadIndex = 0;
    const updatedFiles = pendingData.files.map((file) => {
        if (file.s3Key) return file;
        const uploadedKey = uploadedKeys[uploadIndex];
        uploadIndex += 1;
        return { ...file, s3Key: uploadedKey };
    });

    await savePendingPurchaseData({
        ...pendingData,
        files: updatedFiles,
    });

    return updatedFiles.map((file) => file.s3Key).filter(Boolean) as string[];
}

/**
 * Addon rules carry their own specificationValues (e.g. "binding: hardcover")
 * but these are metadata on top of the base product, NOT part of what
 * identifies the product itself. If we send addon-only keys into
 * getProductsBySpecifications the server's combination lookup can't find a
 * matching BASE_PRICE rule and returns zero products → merge fails with
 * "No matching service product found."
 *
 * Strategy: compute the union of spec keys referenced by live ADDON rules,
 * subtract any key the user's selection would need for the base product
 * (heuristic: keys that only appear in addon rules are safe to drop), and
 * retry the match with the trimmed set if the full match returns zero.
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

    // Strategy 2: drop addon-only spec keys and retry. Addon rules carry
    // their own specificationValues (e.g. "binding: hardcover") which are
    // metadata on top of the base product, not part of what identifies it.
    let addonOnlyKeys: string[] = [];
    try {
        const addons = await getCategoryAddons(categorySlug);
        const addonKeys = new Set<string>();
        for (const rule of addons) {
            const values = (rule.specificationValues || {}) as Record<string, unknown>;
            Object.keys(values).forEach((k) => addonKeys.add(k));
        }
        addonOnlyKeys = Array.from(addonKeys);
    } catch {
        /* best-effort — fall through to next strategy */
    }

    if (addonOnlyKeys.length > 0) {
        const trimmed: Record<string, any> = { ...specifications };
        for (const key of addonOnlyKeys) {
            delete trimmed[key];
        }
        if (Object.keys(trimmed).length !== Object.keys(specifications).length) {
            const second = await getProductsBySpecifications(categorySlug, trimmed);
            if (second && second.length > 0) {
                return pickInStock(second);
            }
        }
    }

    // Strategy 3 (last resort): pick any active product in the category.
    // The user successfully added to cart as a guest (service page computed
    // a price), so a matching product exists — the spec-matching endpoint
    // just couldn't resolve it. Better to land the pending item on the
    // category's generic product than discard the whole configuration.
    try {
        const fallback = await getProducts({ category: categorySlug, limit: 50 });
        const products = fallback.data?.products ?? [];
        if (products.length > 0) {
            return pickInStock(products as any[]);
        }
    } catch {
        /* ignore — return null below */
    }

    return null;
}

async function buildServiceCartPayload(pendingData: PendingPurchaseData): Promise<AddToCartData> {
    if (!pendingData.categorySlug || !pendingData.specifications) {
        throw new Error("Pending service data is incomplete.");
    }

    const matchingProduct = await matchProductForService(
        pendingData.categorySlug,
        pendingData.specifications
    );

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

        let cartPayload =
            pendingData.type === "service"
                ? await buildServiceCartPayload(pendingData)
                : await buildProductCartPayload(pendingData);

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
