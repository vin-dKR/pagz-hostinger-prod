/**
 * Pending Purchase Data Persistence Utilities
 * Handles temporary storage of purchase data during deferred authentication flow
 */

const PENDING_PURCHASE_KEY = 'pendingPurchaseData';
const PENDING_PURCHASE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FILE_SIZE_FOR_BASE64 = 5 * 1024 * 1024; // 5MB per file
const MAX_TOTAL_SIZE_FOR_BASE64 = 10 * 1024 * 1024; // 10MB total

export interface PendingPurchaseFile {
    id: string;
    name: string;
    type: 'image' | 'pdf';
    size: number;
    pageCount: number;
    fileData?: string; // Base64 encoded file (for small files)
    blobUrl?: string; // Blob URL for temporary access (for large files)
    s3Key?: string; // If already uploaded to S3 (for authenticated users)
}

export interface PendingPurchaseData {
    type: 'product' | 'service';
    productId?: string;
    categorySlug?: string;
    files: PendingPurchaseFile[];
    specifications?: Record<string, string>;
    selectedVariant?: string;
    selectedSize?: string;
    selectedAddons?: string[];
    quantity?: number;
    copies?: number;
    pageCount?: number;
    fileHasPassword?: boolean;
    filePassword?: string;
    customText?: string;
    templateId?: string;
    templateFormData?: Record<string, any>;
    templateFormImages?: string[];
    metadata?: {
        pageCount?: number;
        copies?: number;
        selectedAddons?: string[];
        priceBreakdown?: Array<{ label: string; value: number }>;
        templateId?: string;
        templateFormData?: Record<string, any>;
        templateFormImages?: string[];
        fileHasPassword?: boolean;
        filePassword?: string;
        // Half-page ("Both Sides") reduction state — written by the service
        // page when the user picks an option flagged `metadata.isHalfPage`.
        // The cart UI (GuestCart, CartItem) needs all three to (a) feed the
        // reduced count into addon-pricing math and (b) explain the page
        // delta in the breakdown.
        effectivePageCount?: number;
        originalPageCount?: number;
        hasHalfPageAdjustment?: boolean;
    };
    currentPrice?: number;
    totalPrice?: number;
    timestamp: number;
    returnUrl: string;
}

interface StoredPendingPurchaseData extends PendingPurchaseData {
    expiry: number;
}

/**
 * Save pending purchase data to sessionStorage.
 *
 * Strategy:
 *   1. First attempt: full payload (files with base64/blob URLs + all metadata).
 *   2. On QuotaExceededError or JSON size > 5MB cap: retry with files reduced
 *      to metadata-only (name/size/type/pageCount/s3Key) so addons, specs,
 *      template form data and priceBreakdown still survive. A base64-heavy
 *      file payload is the usual culprit, not the configuration data itself.
 *   3. On final failure: throw so the caller can surface a toast instead of
 *      silently redirecting to an empty cart.
 */
export async function savePendingPurchaseData(data: PendingPurchaseData): Promise<void> {
    if (typeof window === 'undefined') return;

    const processedFiles: PendingPurchaseFile[] = await Promise.all(
        data.files.map(async (file) => {
            if (file.s3Key) return file;
            if (file.fileData || file.blobUrl) return file;
            return file;
        })
    );

    const buildPayload = (files: PendingPurchaseFile[]): StoredPendingPurchaseData => ({
        ...data,
        files,
        expiry: Date.now() + PENDING_PURCHASE_EXPIRY,
    });

    const trySetItem = (payload: StoredPendingPurchaseData): { ok: true; size: number } | { ok: false; reason: 'quota' | 'other'; error: unknown } => {
        try {
            const serialized = JSON.stringify(payload);
            if (serialized.length > 5 * 1024 * 1024) {
                return { ok: false, reason: 'quota', error: new Error(`payload size ${serialized.length} exceeds 5MB`) };
            }
            sessionStorage.setItem(PENDING_PURCHASE_KEY, serialized);
            return { ok: true, size: serialized.length };
        } catch (error) {
            const isQuota = error instanceof DOMException && (
                error.name === 'QuotaExceededError' ||
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            );
            return { ok: false, reason: isQuota ? 'quota' : 'other', error };
        }
    };

    // Attempt 1: full payload.
    const first = trySetItem(buildPayload(processedFiles));
    if (first.ok) return;

    console.warn('[pending-purchase] First save failed:', first.reason, first.error);

    if (first.reason !== 'quota') {
        throw first.error instanceof Error
            ? first.error
            : new Error('Failed to save pending purchase data');
    }

    // Attempt 2: drop heavy file payloads (keep metadata only).
    sessionStorage.removeItem(PENDING_PURCHASE_KEY);

    const lightFiles = processedFiles.map<PendingPurchaseFile>((file) => {
        // Revoke blob URL since we're dropping it; otherwise it leaks.
        if (file.blobUrl) {
            try { URL.revokeObjectURL(file.blobUrl); } catch { /* ignore */ }
        }
        return {
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            pageCount: file.pageCount,
            s3Key: file.s3Key,
        };
    });

    const second = trySetItem(buildPayload(lightFiles));
    if (second.ok) {
        console.warn('[pending-purchase] Saved without file contents due to storage quota; files must be re-uploaded after login.');
        return;
    }

    console.error('[pending-purchase] Final save failed:', second.error);
    throw second.error instanceof Error
        ? second.error
        : new Error('Failed to save pending purchase data');
}

/**
 * Get pending purchase data from sessionStorage
 */
export function getPendingPurchaseData(): PendingPurchaseData | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = sessionStorage.getItem(PENDING_PURCHASE_KEY);
        if (!stored) return null;

        const data = JSON.parse(stored) as StoredPendingPurchaseData;
        
        // Check if data has expired
        if (Date.now() > data.expiry) {
            clearPendingPurchaseData();
            return null;
        }

        // Remove expiry before returning
        const { expiry, ...purchaseData } = data;
        return purchaseData;
    } catch (error) {
        console.error('[pending-purchase] Failed to get pending purchase data:', error);
        // Clear corrupted data
        clearPendingPurchaseData();
        return null;
    }
}

/**
 * Clear pending purchase data
 */
export function clearPendingPurchaseData(): void {
    if (typeof window === 'undefined') return;

    try {
        sessionStorage.removeItem(PENDING_PURCHASE_KEY);
        
        // Also clean up any blob URLs that might be stored
        const stored = sessionStorage.getItem(PENDING_PURCHASE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored) as StoredPendingPurchaseData;
                data.files?.forEach(file => {
                    if (file.blobUrl) {
                        try {
                            URL.revokeObjectURL(file.blobUrl);
                        } catch (e) {
                            // Ignore errors when revoking blob URLs
                        }
                    }
                });
            } catch (e) {
                // Ignore errors when parsing
            }
        }
    } catch (error) {
        console.error('[pending-purchase] Failed to clear pending purchase data:', error);
    }
}

/**
 * Check if there's pending purchase data
 */
export function hasPendingPurchaseData(): boolean {
    return getPendingPurchaseData() !== null;
}

/**
 * Convert File to Base64 (for temporary storage of small files)
 * Only use for files < 5MB
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (file.size > MAX_FILE_SIZE_FOR_BASE64) {
            reject(new Error(`File too large for base64 encoding: ${file.size} bytes`));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Convert Base64 to File
 */
export function base64ToFile(base64: string, filename: string, mimeType: string): File {
    const arr = base64.split(',');
    const dataPart = arr[1];
    if (!dataPart) {
        throw new Error('Invalid base64 string: missing data part');
    }
    const mime = arr[0]?.match(/:(.*?);/)?.[1] || mimeType;
    const bstr = atob(dataPart);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

/**
 * Create blob URL from file (for temporary storage of large files)
 * Caller is responsible for revoking the URL when done
 */
export function createBlobUrl(file: File): string {
    return URL.createObjectURL(file);
}

/**
 * Revoke blob URL
 */
export function revokeBlobUrl(url: string): void {
    try {
        URL.revokeObjectURL(url);
    } catch (error) {
        // Ignore errors when revoking
        console.warn('[pending-purchase] Failed to revoke blob URL:', error);
    }
}

/**
 * Check if files should use base64 or blob URLs
 * Returns true if files are small enough for base64
 */
export function shouldUseBase64(files: File[]): boolean {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    return totalSize <= MAX_TOTAL_SIZE_FOR_BASE64 && 
           files.every(file => file.size <= MAX_FILE_SIZE_FOR_BASE64);
}

/**
 * Prepare files for storage (convert to base64 or create blob URLs)
 * Returns optimized file data ready for sessionStorage
 */
export async function prepareFilesForStorage(
    files: File[],
    fileDetails: Array<{ id: string; type: 'image' | 'pdf'; pageCount: number; s3Key?: string }> 
): Promise<PendingPurchaseFile[]> {
    const useBase64 = shouldUseBase64(files);
    
    return Promise.all(
        files.map(async (file, index) => {
            const detail = fileDetails[index];
            if (!detail) {
                throw new Error(`Missing file detail for file at index ${index}`);
            }
            const fileData: PendingPurchaseFile = {
                id: detail.id,
                name: file.name,
                type: detail.type,
                size: file.size,
                pageCount: detail.pageCount,
            };

            // If file already has s3Key (already uploaded), preserve it and skip base64/blob conversion
            if (detail.s3Key) {
                fileData.s3Key = detail.s3Key;
                return fileData;
            }

            if (useBase64) {
                try {
                    fileData.fileData = await fileToBase64(file);
                } catch (error) {
                    console.warn(`[pending-purchase] Failed to convert ${file.name} to base64, using blob URL instead`);
                    fileData.blobUrl = createBlobUrl(file);
                }
            } else {
                fileData.blobUrl = createBlobUrl(file);
            }

            return fileData;
        })
    );
}

/**
 * Restore files from pending purchase data
 * Converts base64/blob URLs back to File objects
 * If file has s3Key (already uploaded), creates a minimal File object with metadata
 */
export async function restoreFilesFromPendingData(
    pendingFiles: PendingPurchaseFile[]
): Promise<File[]> {
    return Promise.all(
        pendingFiles.map(async (fileData) => {
            // If file already has s3Key (uploaded to S3), create a minimal File object
            // The actual file content is in S3, we just need the File object for UI purposes
            if (fileData.s3Key) {
                // Create a minimal File object with correct metadata
                // The file is already in S3, so we don't need the actual content
                const mimeType = fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg';
                const blob = new Blob([], { type: mimeType });
                const file = new File([blob], fileData.name, {
                    type: mimeType,
                    lastModified: Date.now(),
                });
                // Override size property to preserve original file size
                if (fileData.size && fileData.size > 0) {
                    Object.defineProperty(file, 'size', {
                        value: fileData.size,
                        writable: false,
                        enumerable: true,
                        configurable: true,
                    });
                }
                return file;
            } else if (fileData.fileData && typeof fileData.fileData === 'string' && fileData.fileData.trim().length > 0) {
                // Validate base64 string before converting
                // Check if it contains a comma (data URL format) or is valid base64
                const base64Str = fileData.fileData.trim();
                if (base64Str.includes(',')) {
                    // Data URL format: data:mime;base64,<data>
                    const parts = base64Str.split(',');
                    if (parts.length >= 2 && parts[1] && parts[1].trim().length > 0) {
                        // Convert base64 back to File
                        return base64ToFile(
                            base64Str,
                            fileData.name,
                            fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg'
                        );
                    }
                } else {
                    // Plain base64 string - validate it's not empty
                    if (base64Str.length > 0) {
                        // Try to decode to validate
                        try {
                            atob(base64Str);
                            // Valid base64, convert to File (add data URL prefix)
                            return base64ToFile(
                                `data:${fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg'};base64,${base64Str}`,
                                fileData.name,
                                fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg'
                            );
                        } catch (e) {
                            console.warn(`[pending-purchase] Invalid base64 string for ${fileData.name}, will create minimal file or use blobUrl`);
                            // Fall through to check blobUrl or create minimal file
                        }
                    }
                }
                // If base64 conversion failed or was invalid, fall through to check blobUrl or create minimal file
            }
            
            if (fileData.blobUrl) {
                // Fetch blob URL and convert to File
                try {
                    const response = await fetch(fileData.blobUrl);
                    const blob = await response.blob();
                    return new File([blob], fileData.name, {
                        type: fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
                    });
                } catch (error) {
                    console.error(`[pending-purchase] Failed to restore file from blob URL: ${fileData.name}`, error);
                    // Fall through to create minimal file as last resort
                }
            }
            
            // Last resort: Create a minimal File object if we have s3Key or if other methods failed
            // This allows the UI to work even if we can't restore the actual file content
            if (fileData.s3Key || fileData.name) {
                console.warn(`[pending-purchase] Creating minimal File object for ${fileData.name} (s3Key: ${fileData.s3Key || 'none'})`);
                const mimeType = fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg';
                const blob = new Blob([], { type: mimeType });
                const file = new File([blob], fileData.name, {
                    type: mimeType,
                    lastModified: Date.now(),
                });
                // Override size property to preserve original file size if available
                if (fileData.size && fileData.size > 0) {
                    Object.defineProperty(file, 'size', {
                        value: fileData.size,
                        writable: false,
                        enumerable: true,
                        configurable: true,
                    });
                }
                return file;
            }
            
            // If we have absolutely nothing, throw error
            throw new Error(`No file data available for: ${fileData.name || 'unknown file'}`);
        })
    );
}
