/**
 * Uploads API — Web / Storefront
 *
 * All file uploads now go through the FTP service instead of AWS S3.
 * Files are organised into purpose-specific folders on the server.
 */

import {
    uploadMultipleFiles,
    uploadOneFile as ftpUploadOneFile,
    FTP_FOLDERS,
    type FTPUploadFailure,
    type UploadProgressCallback,
    type UploadProgressEvent,
} from './ftp';
import { extractPathFromUrl } from '../utils/fileUrl';
import type { ApiResponse } from '../api-client';
import { assertNonEmptyFiles, EmptyFilesError } from '../utils/file-validation';

// Re-export progress types so callers can import them from the canonical
// uploads module without reaching into ./ftp.
export type { UploadProgressCallback, UploadProgressEvent };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadFileResult {
    key: string;
    url: string;
    filename: string;
    size: number;
    mimetype: string;
    /**
     * The user-facing filename from the original `File`. Optional because
     * the FTP-tier helpers (`ftp.ts → uploadMultipleFiles`) populate it
     * from a different field — kept as `string | undefined` so legacy
     * consumers that only need `key` / `url` keep working.
     */
    originalName?: string;
}

export interface UploadFilesResponse {
    files: UploadFileResult[];
    sessionId?: string;
    /** Per-file failures from a partial batch. Empty / undefined when all succeeded. */
    failures?: FTPUploadFailure[];
    /** Convenience flag mirroring the backend response. */
    partial?: boolean;
}

// ─── Order files ─────────────────────────────────────────────────────────────

/**
 * Upload customer design / order files.
 *
 * Files land in the `orders/` folder on the server.
 * Returns S3-shaped response for backward compatibility with existing cart logic.
 *
 * @param files  One or more design files (images or PDFs).
 */
export async function uploadOrderFilesToS3(
    files: File[],
): Promise<ApiResponse<UploadFilesResponse>> {
    try {
        // Reject 0-byte files BEFORE the network round-trip. The helper
        // throws `EmptyFilesError` whose message already includes every
        // offending filename, so we just bubble it up.
        assertNonEmptyFiles(files);

        const result = await uploadMultipleFiles(files, FTP_FOLDERS.ORDERS);

        const uploadedFiles: UploadFileResult[] = result.files.map((f) => ({
            key:          f.path,       // Relative path stored in DB
            url:          f.publicUrl,  // Full URL for display
            filename:     f.filename,
            size:         f.size,
            mimetype:     f.mimetype,
            originalName: f.originalName,
        }));

        return {
            success: true,
            data: {
                files:    uploadedFiles,
                failures: result.failures,
                partial:  result.partial,
            },
        };
    } catch (error: any) {
        // Preserve EmptyFilesError shape so callers can branch on it if
        // they want a custom UI; the default `error` string is the
        // already-formatted human message.
        if (error instanceof EmptyFilesError) {
            return { success: false, error: error.message };
        }
        return {
            success: false,
            error:   error?.message || 'Failed to upload order files',
        };
    }
}

/**
 * Upload a single order/design file with real-time progress + cancel support.
 *
 * Thin wrapper around the low-level XHR uploader in `./ftp` that maps the
 * raw `FTPUploadResult` to the `UploadFileResult` shape the rest of the web
 * app already consumes (`key`, `url`, `filename`, `size`, `mimetype`).
 *
 * Use this for serial multi-file flows where each file gets its own progress
 * bar and retry button. For one-shot batch uploads where progress isn't
 * needed, prefer {@link uploadOrderFilesToS3}.
 *
 * @param file        The file to upload (must be non-empty).
 * @param onProgress  Per-file progress callback (`{ loaded, total, percent }`).
 * @param opts        AbortSignal for cancellation.
 */
export async function uploadOneFile(
    file: File,
    onProgress?: UploadProgressCallback,
    opts?: { signal?: AbortSignal },
): Promise<UploadFileResult> {
    const result = await ftpUploadOneFile(file, onProgress, {
        folder: FTP_FOLDERS.ORDERS,
        signal: opts?.signal,
    });
    return {
        key:      result.path,
        url:      result.publicUrl,
        filename: result.filename,
        size:     result.size,
        mimetype: result.mimetype,
    };
}

// ─── Review images ────────────────────────────────────────────────────────────

/**
 * Upload review images for a product.
 *
 * Files land in the `reviews/` folder on the server.
 *
 * @param files      One or more image files.
 * @param productId  Optional — not used for routing but kept for API parity.
 */
export async function uploadReviewImages(
    files: File[],
    _productId?: string,
): Promise<ApiResponse<UploadFilesResponse>> {
    try {
        assertNonEmptyFiles(files);

        const result = await uploadMultipleFiles(files, FTP_FOLDERS.REVIEWS);

        const uploadedFiles: UploadFileResult[] = result.files.map((f) => ({
            key:          f.path,
            url:          f.publicUrl,
            filename:     f.filename,
            size:         f.size,
            mimetype:     f.mimetype,
            originalName: f.originalName,
        }));

        return {
            success: true,
            data: {
                files:    uploadedFiles,
                failures: result.failures,
                partial:  result.partial,
            },
        };
    } catch (error: any) {
        if (error instanceof EmptyFilesError) {
            return { success: false, error: error.message };
        }
        return {
            success: false,
            error:   error?.message || 'Failed to upload review images',
        };
    }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete an order file from the server.
 *
 * NOTE: The FTP delete endpoint exists but requires the relative file path.
 *       We pass through the key (which is already the relative path).
 */
export async function deleteOrderFile(fileKey: string): Promise<ApiResponse<null>> {
    // Normalize: accept both a relative FTP path ("orders/abc.pdf") and a
    // full URL ("https://pagz.in/orders/abc.pdf"). encodeURIComponent
    // keeps `/` as `%2F` so the single-segment :filePath route still
    // captures the full path; Express auto-decodes back on the server.
    //
    // Public call — no Authorization header. Matches the public upload
    // routes; services page lets guests configure + upload before login
    // so the matching cleanup can't require auth. The backend enforces
    // a folder allowlist instead.
    const path = extractPathFromUrl(fileKey);
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';
    try {
        const response = await fetch(
            `${API_BASE_URL}/ftp/delete/${encodeURIComponent(path)}`,
            { method: 'DELETE' },
        );
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return {
                success: false,
                error: data.message || data.error || `Failed to delete file (${response.status})`,
            };
        }
        return { success: true, data: null };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete file';
        console.warn('[uploads] deleteOrderFile failed:', message);
        return { success: false, error: message };
    }
}
