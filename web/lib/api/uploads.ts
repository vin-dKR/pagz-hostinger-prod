/**
 * Uploads API functions
 */

import { uploadFile, del, ApiResponse } from '../api-client';

export interface UploadFileResult {
    key: string; // S3 key (path)
    url: string; // Presigned URL
    filename: string;
    size: number;
    mimetype: string;
}

export interface UploadFilesResponse {
    files: UploadFileResult[];
    sessionId?: string;
}

/**
 * Upload files to S3 (temporary location for cart)
 * Returns S3 keys that can be stored in cart items
 */
export async function uploadOrderFilesToS3(
    files: File[]
): Promise<ApiResponse<UploadFilesResponse>> {
    return uploadFile<UploadFilesResponse>(
        '/upload/order-files',
        files
    );
}

/**
 * Upload review images to S3
 * Returns public URLs for review images (stored in images/reviews folder)
 */
export async function uploadReviewImages(
    files: File[],
    productId?: string
): Promise<ApiResponse<UploadFilesResponse>> {
    const additionalData: Record<string, string> = {};
    if (productId) {
        additionalData.productId = productId;
    }
    return uploadFile<UploadFilesResponse>(
        '/upload/review-images',
        files,
        additionalData
    );
}

/**
 * Delete order file from S3
 */
export async function deleteOrderFile(fileKey: string): Promise<ApiResponse<null>> {
    return del<null>(`/upload/order-file/${encodeURIComponent(fileKey)}`);
}

