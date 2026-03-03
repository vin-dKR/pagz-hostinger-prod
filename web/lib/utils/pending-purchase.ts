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
    customText?: string;
    metadata?: {
        pageCount?: number;
        copies?: number;
        selectedAddons?: string[];
        priceBreakdown?: Array<{ label: string; value: number }>;
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
 * Save pending purchase data to sessionStorage
 * Uses optimized storage: base64 for small files, blob URLs for large files
 */
export async function savePendingPurchaseData(data: PendingPurchaseData): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        // Process files: convert to base64 if small, use blob URL if large
        const processedFiles: PendingPurchaseFile[] = await Promise.all(
            data.files.map(async (file) => {
                // If already has s3Key, keep it
                if (file.s3Key) {
                    return file;
                }

                // If already has fileData or blobUrl, keep it
                if (file.fileData || file.blobUrl) {
                    return file;
                }

                // This shouldn't happen in normal flow, but handle it gracefully
                return file;
            })
        );

        const dataWithExpiry: StoredPendingPurchaseData = {
            ...data,
            files: processedFiles,
            expiry: Date.now() + PENDING_PURCHASE_EXPIRY,
        };

        const serialized = JSON.stringify(dataWithExpiry);
        
        // Check if data is too large for sessionStorage
        if (serialized.length > 5 * 1024 * 1024) { // 5MB limit
            console.warn('[pending-purchase] Data too large for sessionStorage, clearing old data');
            // Try to clear and save anyway - might work if browser allows
        }

        sessionStorage.setItem(PENDING_PURCHASE_KEY, serialized);
    } catch (error) {
        console.error('[pending-purchase] Failed to save pending purchase data:', error);
        // If quota exceeded, try to clear and retry once
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            try {
                sessionStorage.removeItem(PENDING_PURCHASE_KEY);
                const dataWithExpiry: StoredPendingPurchaseData = {
                    ...data,
                    expiry: Date.now() + PENDING_PURCHASE_EXPIRY,
                };
                sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(dataWithExpiry));
            } catch (retryError) {
                console.error('[pending-purchase] Failed to save after clearing:', retryError);
            }
        }
    }
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
    fileDetails: Array<{ id: string; type: 'image' | 'pdf'; pageCount: number }> 
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
 */
export async function restoreFilesFromPendingData(
    pendingFiles: PendingPurchaseFile[]
): Promise<File[]> {
    return Promise.all(
        pendingFiles.map(async (fileData) => {
            if (fileData.fileData) {
                // Convert base64 back to File
                return base64ToFile(
                    fileData.fileData,
                    fileData.name,
                    fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg'
                );
            } else if (fileData.blobUrl) {
                // Fetch blob URL and convert to File
                try {
                    const response = await fetch(fileData.blobUrl);
                    const blob = await response.blob();
                    return new File([blob], fileData.name, {
                        type: fileData.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
                    });
                } catch (error) {
                    console.error(`[pending-purchase] Failed to restore file from blob URL: ${fileData.name}`, error);
                    throw new Error(`Failed to restore file: ${fileData.name}`);
                }
            } else {
                throw new Error(`No file data available for: ${fileData.name}`);
            }
        })
    );
}
