/**
 * File Storage Utility
 * Stores files in browser memory/IndexedDB for upload after order confirmation
 * This avoids uploading files to S3 until order is confirmed, saving costs
 *
 * Uses IndexedDB to persist File objects across page refreshes
 */

// IndexedDB setup for persisting File objects
let db: IDBDatabase | null = null;
const DB_NAME = 'fileStorageDB';
const STORE_NAME = 'pendingFiles';
const DB_VERSION = 1;

async function initDB(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
}

async function storeFileInIndexedDB(key: string, files: File[]): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    try {
        const database = await initDB();
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Store files as ArrayBuffer (can be restored)
        const fileData = await Promise.all(
            files.map(async (file) => ({
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
                size: file.size,
                data: await file.arrayBuffer(),
            }))
        );

        await store.put({ key, files: fileData });
    } catch (e) {
        console.warn('[fileStorage] Failed to store files in IndexedDB:', e);
    }
}

export async function getFilesFromIndexedDB(key: string): Promise<File[]> {
    if (typeof window === 'undefined' || !window.indexedDB) return [];

    try {
        const database = await initDB();
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        return new Promise((resolve) => {
            request.onsuccess = () => {
                const result = request.result;
                if (result && result.files) {
                    const files = result.files.map((f: any) => new File([f.data], f.name, { type: f.type, lastModified: f.lastModified }));
                    resolve(files);
                } else {
                    resolve([]);
                }
            };
            request.onerror = () => {
                console.warn(`[fileStorage] Failed to get files from IndexedDB for key ${key}:`, request.error);
                resolve([]);
            };
        });
    } catch (e) {
        console.warn('[fileStorage] Failed to get files from IndexedDB:', e);
        return [];
    }
}

interface FileMetadata {
    name: string;
    size: number;
    type: string;
    pageCount?: number;
    productId?: string;
    variantId?: string;
}

interface PendingFile {
    file: File | null; // Can be null if restored from sessionStorage (metadata only)
    metadata: FileMetadata;
    tempId: string;
}

// Global file store (in-memory only - cleared on page refresh)
const fileStore = new Map<string, PendingFile[]>();

// Initialize fileStore from sessionStorage on module load (metadata only - File objects can't be restored)
if (typeof window !== 'undefined') {
    try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('pending_files_')) {
                // Extract the actual key (remove 'pending_files_' prefix)
                const actualKey = key.replace('pending_files_', '');
                // Check if files are already in memory
                if (!fileStore.has(actualKey)) {
                    try {
                        // Metadata only - File objects can't be restored from sessionStorage
                        // These will be replaced when files are restored from IndexedDB
                    } catch (e) {
                        // Silent fail
                    }
                }
            }
        });
    } catch (e) {
        console.warn('[fileStorage] Failed to initialize from sessionStorage:', e);
    }
}

/**
 * Store files for a product/variant combination
 */
export function storePendingFiles(productId: string, variantId: string | undefined, files: File[], metadata: FileMetadata[]): void {
    const key = `${productId}_${variantId || 'default'}`;
    const pendingFiles: PendingFile[] = files.map((file, index) => ({
        file,
        metadata: metadata[index] || {
            name: file.name,
            size: file.size,
            type: file.type,
        },
        tempId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    // Store in memory (primary - has File objects)
    fileStore.set(key, pendingFiles);

    // Store in IndexedDB for persistence across page refreshes (async, non-blocking)
    storeFileInIndexedDB(key, files).catch(e => {
        console.warn('[fileStorage] IndexedDB storage failed (non-critical):', e);
    });

    // Also store metadata in sessionStorage as backup (metadata only, for quick access)
    try {
        const metadataOnly = pendingFiles.map(pf => pf.metadata);
        const sessionKey = `pending_files_${key}`;
        sessionStorage.setItem(sessionKey, JSON.stringify(metadataOnly));
    } catch (e) {
        console.warn('[fileStorage] Could not store file metadata in sessionStorage:', e);
    }
}

/**
 * Get pending files for a product/variant (SYNC - returns immediately)
 * Checks memory first, then sessionStorage (metadata only)
 * IndexedDB restore happens async in background and updates memory
 */
export function getPendingFiles(productId: string, variantId: string | undefined): PendingFile[] {
    const key = `${productId}_${variantId || 'default'}`;
    const memoryFiles = fileStore.get(key) || [];

    // If we have files in memory, return them (fastest)
    if (memoryFiles.length > 0) {
        return memoryFiles;
    }

    // Try to restore from sessionStorage (metadata only, sync)
    if (typeof window !== 'undefined') {
        try {
            const sessionKey = `pending_files_${key}`;
            const metadataJson = sessionStorage.getItem(sessionKey);
            if (metadataJson) {
                const metadata: FileMetadata[] = JSON.parse(metadataJson);
                if (metadata.length > 0) {
                    // Create placeholder entries with metadata only
                    const placeholderFiles: PendingFile[] = metadata.map((meta, index) => ({
                        file: null, // Can't restore File object from sessionStorage
                        metadata: meta,
                        tempId: `placeholder_${Date.now()}_${index}`,
                    }));

                    // Try to restore actual File objects from IndexedDB in background (async, non-blocking)
                    getFilesFromIndexedDB(key).then(files => {
                        if (files.length > 0) {
                            const restoredFiles: PendingFile[] = files.map((file, index) => ({
                                file,
                                metadata: metadata[index] || {
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                },
                                tempId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            }));
                            fileStore.set(key, restoredFiles);
                        }
                    }).catch(e => {
                        console.warn(`[fileStorage] IndexedDB restore failed for ${key}:`, e);
                    });

                    return placeholderFiles;
                }
            }
        } catch (e) {
            console.warn(`[fileStorage] Failed to restore from sessionStorage for ${key}:`, e);
        }

        // Try IndexedDB in background if sessionStorage also empty
        getFilesFromIndexedDB(key).then(files => {
            if (files.length > 0) {
                const metadata: FileMetadata[] = files.map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type,
                }));
                const restoredFiles: PendingFile[] = files.map((file, index) => ({
                    file,
                    metadata: metadata[index] || {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    },
                    tempId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                }));
                fileStore.set(key, restoredFiles);
            }
        }).catch(e => {
            // Silent fail - IndexedDB might not be available
        });
    }

    return [];
}

/**
 * Get all pending files (for checkout)
 * Checks both in-memory store AND sessionStorage (always check both)
 */
export function getAllPendingFiles(): Array<{ productId: string; variantId?: string; files: PendingFile[] }> {
    const results: Array<{ productId: string; variantId?: string; files: PendingFile[] }> = [];
    const processedKeys = new Set<string>();

    // First, get files from in-memory store (these have actual File objects)
    fileStore.forEach((files, key) => {
        const parts = key.split('_');
        const productId = parts[0] || '';
        if (!productId) return; // Skip invalid keys

        const variantIdPart = parts.length > 1 ? parts[1] : undefined;
        const variantId = variantIdPart && variantIdPart !== 'default' ? variantIdPart : undefined;

        if (files.length > 0) {
            processedKeys.add(key); // Mark as processed
            results.push({
                productId,
                variantId,
                files,
            });
        }
    });

    // ALWAYS check sessionStorage (even if memory has files) to catch any files stored with different key formats
    // Note: We can't restore File objects from sessionStorage, but we can show metadata
    if (typeof window !== 'undefined') {
        try {
            const sessionKeys = Object.keys(sessionStorage);
            const pendingFileKeys = sessionKeys.filter(k => k.startsWith('pending_files_'));

            pendingFileKeys.forEach(key => {
                try {
                    const actualKey = key.replace('pending_files_', '');

                    // Skip if already processed from memory (memory takes precedence - has actual File objects)
                    if (processedKeys.has(actualKey)) {
                        return;
                    }

                    const metadataJson = sessionStorage.getItem(key);
                    if (metadataJson) {
                        const metadata: FileMetadata[] = JSON.parse(metadataJson);

                        if (metadata.length > 0) {
                            // Parse key: could be "productId" or "productId_variantId" or "productId_default"
                            const parts = actualKey.split('_');
                            let productId = '';
                            let variantId: string | undefined = undefined;

                            if (parts.length >= 1) {
                                productId = parts[0] || '';
                                if (parts.length > 1) {
                                    const remainingParts = parts.slice(1);
                                    const variantIdPart = remainingParts.join('_');
                                    variantId = variantIdPart && variantIdPart !== 'default' ? variantIdPart : undefined;
                                }
                            }

                            if (!productId) {
                                return;
                            }

                            // Check if we already have this product/variant combination from memory
                            const alreadyExists = results.some(r =>
                                r.productId === productId &&
                                (r.variantId === variantId || (!r.variantId && !variantId))
                            );

                            if (!alreadyExists) {
                                // Create placeholder PendingFile entries with metadata only
                                const placeholderFiles: PendingFile[] = metadata.map((meta, index) => ({
                                    file: null, // Can't restore File object from JSON
                                    metadata: meta,
                                    tempId: `placeholder_${Date.now()}_${index}`,
                                }));

                                results.push({
                                    productId,
                                    variantId,
                                    files: placeholderFiles,
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[fileStorage] Failed to restore from sessionStorage key ${key}:`, e);
                }
            });
        } catch (e) {
            console.error('[fileStorage] Failed to check sessionStorage:', e);
        }
    }

    return results;
}

/**
 * Clear pending files for a product/variant
 */
export function clearPendingFiles(productId: string, variantId: string | undefined): void {
    const key = `${productId}_${variantId || 'default'}`;
    fileStore.delete(key);

    try {
        sessionStorage.removeItem(`pending_files_${key}`);
    } catch (e) {
        console.warn('Could not remove file metadata from sessionStorage:', e);
    }
}

/**
 * Clear all pending files (after order confirmation)
 */
export function clearAllPendingFiles(): void {
    fileStore.clear();

    // Clear sessionStorage
    try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('pending_files_')) {
                sessionStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('Could not clear file metadata from sessionStorage:', e);
    }
}

/**
 * Get File objects for upload (filters out null files)
 */
export function getFilesForUpload(productId: string, variantId: string | undefined): File[] {
    const pendingFiles = getPendingFiles(productId, variantId);
    return pendingFiles
        .map(pf => pf.file)
        .filter((f): f is File => f !== null && f instanceof File);
}

