import { addToCart, type AddToCartData } from "@/lib/api/cart";
import { getProductsBySpecifications } from "@/lib/api/categories";
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

async function buildServiceCartPayload(pendingData: PendingPurchaseData): Promise<AddToCartData> {
    if (!pendingData.categorySlug || !pendingData.specifications) {
        throw new Error("Pending service data is incomplete.");
    }

    const matchingProducts = await getProductsBySpecifications(
        pendingData.categorySlug,
        pendingData.specifications
    );
    const matchingProduct =
        matchingProducts.find((product: any) => product?.id && (product.stock === undefined || product.stock > 0)) ||
        matchingProducts[0];

    if (!matchingProduct?.id) {
        throw new Error("No matching service product found.");
    }

    const uploadedFileKeys = await ensureUploadedFileKeys(pendingData);
    const selectedAddons = getSelectedAddons(pendingData);

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
    const selectedAddons = getSelectedAddons(pendingData);

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

        const cartPayload =
            pendingData.type === "service"
                ? await buildServiceCartPayload(pendingData)
                : await buildProductCartPayload(pendingData);

        let lastError = "Failed to add pending item to cart.";

        for (let attempt = 0; attempt < ADD_TO_CART_MAX_RETRIES; attempt++) {
            try {
                const response = await addToCart(cartPayload);
                if (response.success) {
                    clearPendingPurchaseData();
                    return { handled: true, success: true };
                }

                lastError = response.error || lastError;
                const lowerError = lastError.toLowerCase();
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
