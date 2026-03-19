/**
 * Uploads API — Web / Storefront
 *
 * All file uploads now go through the FTP service instead of AWS S3.
 * Files are organised into purpose-specific folders on the server.
 */

import { uploadMultipleFiles, uploadSingleFile, FTP_FOLDERS } from './ftp';
import type { ApiResponse } from '../api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadFileResult {
    key: string;
    url: string;
    filename: string;
    size: number;
    mimetype: string;
}

export interface UploadFilesResponse {
    files: UploadFileResult[];
    sessionId?: string;
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
        const result = await uploadMultipleFiles(files, FTP_FOLDERS.ORDERS);

        const uploadedFiles: UploadFileResult[] = result.files.map((f) => ({
            key:      f.path,       // Relative path stored in DB
            url:      f.publicUrl,  // Full URL for display
            filename: f.filename,
            size:     f.size,
            mimetype: f.mimetype,
        }));

        return {
            success: true,
            data: { files: uploadedFiles },
        };
    } catch (error: any) {
        return {
            success: false,
            error:   error?.message || 'Failed to upload order files',
        };
    }
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
        const result = await uploadMultipleFiles(files, FTP_FOLDERS.REVIEWS);

        const uploadedFiles: UploadFileResult[] = result.files.map((f) => ({
            key:      f.path,
            url:      f.publicUrl,
            filename: f.filename,
            size:     f.size,
            mimetype: f.mimetype,
        }));

        return {
            success: true,
            data: { files: uploadedFiles },
        };
    } catch (error: any) {
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
    try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';
        const response = await fetch(
            `${API_BASE_URL}/ftp/delete/${encodeURIComponent(fileKey)}`,
            { method: 'DELETE' },
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return {
                success: false,
                error: data.message || data.error || 'Failed to delete file',
            };
        }

        return { success: true, data: null };
    } catch (error: any) {
        // Non-fatal — log but don't block the UI
        console.warn('[uploads] deleteOrderFile failed (non-critical):', error?.message);
        return { success: false, error: error?.message || 'Failed to delete file' };
    }
}
