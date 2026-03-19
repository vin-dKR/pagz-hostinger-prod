/**
 * FTP Upload Service  (Admin)
 *
 * Centralises all file uploads for the admin panel through the FTP endpoint.
 * Files are stored with a clear folder structure so different features have
 * their own directories — easy to manage, easy to audit.
 *
 * Folder structure on the server:
 *   products/   — product images
 *   categories/ — category images
 *   carousel/   — homepage carousel banners
 *   orders/     — customer design / order files
 *   reviews/    — review images
 *   templates/  — service template preview images
 *
 * DB storage convention:
 *   Only the RELATIVE path is stored (e.g. "products/12345-image.jpg").
 *   The domain is prepended at render time via `getPublicFileUrl()`.
 */

import { getAuthToken } from './api-client';
import { extractPathFromUrl } from '../utils/fileUrl';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FTPUploadResult {
    /** Relative path suitable for DB storage: "products/12345-image.jpg" */
    path: string;
    /** Full public URL: "https://pagz.in/products/12345-image.jpg" */
    publicUrl: string;
    filename: string;
    size: number;
    mimetype: string;
    originalName: string;
}

// ─── Folder constants ────────────────────────────────────────────────────────

/** Canonical folder names — use these everywhere to avoid typos. */
export const FTP_FOLDERS = {
    PRODUCTS:   'products',
    CATEGORIES: 'categories',
    CAROUSEL:   'carousel',
    ORDERS:     'orders',
    REVIEWS:    'reviews',
    TEMPLATES:  'templates',
} as const;

export type FTPFolder = (typeof FTP_FOLDERS)[keyof typeof FTP_FOLDERS];

// ─── Internal helpers ────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/** Build auth headers — adds Bearer token when the user is signed in. */
function buildAuthHeaders(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

interface RawFTPApiResponse {
    success: boolean;
    message?: string;
    error?: string;
    data?: RawFTPFileData | { files: RawFTPFileData[]; count: number };
}

interface RawFTPFileData {
    publicUrl: string;
    remoteFileName: string;
    size: number;
    mimetype: string;
    originalName: string;
}

/** Parse a fetch Response and throw a user-friendly Error on failure. */
async function parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    let data: RawFTPApiResponse;

    if (contentType.includes('application/json')) {
        data = await response.json() as RawFTPApiResponse;
    } else {
        const text = await response.text();
        data = {
            success: false,
            message: `Server returned ${response.status} ${response.statusText}`,
            error: text || 'Unexpected server response',
        };
    }

    if (!response.ok || data.success === false) {
        const msg =
            data.message ||
            data.error ||
            `Upload failed with status ${response.status}`;
        throw new Error(msg);
    }

    return data.data as T;
}

/** Map a raw FTP API response object to our canonical FTPUploadResult. */
function mapResult(raw: RawFTPFileData): FTPUploadResult {
    return {
        path:         extractPathFromUrl(raw.publicUrl),
        publicUrl:    raw.publicUrl,
        filename:     raw.remoteFileName,
        size:         raw.size,
        mimetype:     raw.mimetype,
        originalName: raw.originalName,
    };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload a single file to the FTP server in the given folder.
 *
 * @param file    The file to upload.
 * @param folder  Destination folder — use one of `FTP_FOLDERS.*`.
 * @returns       Upload result with relative path + full public URL.
 *
 * @example
 *   const result = await uploadFileToFTP(file, FTP_FOLDERS.PRODUCTS);
 *   // store result.path → "products/1712345678-image.jpg"
 *   // display via getPublicFileUrl(result.path) → "https://pagz.in/products/1712345678-image.jpg"
 */
export async function uploadFileToFTP(
    file: File,
    folder: FTPFolder,
): Promise<FTPUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subDir', folder);

    const response = await fetch(`${API_BASE_URL}/ftp/upload`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: formData,
    });

    const raw = await parseResponse<RawFTPFileData>(response);
    return mapResult(raw);
}

/**
 * Upload multiple files to the FTP server in the given folder.
 *
 * Files are uploaded in one multipart request for efficiency.
 *
 * @param files   Array of files to upload.
 * @param folder  Destination folder — use one of `FTP_FOLDERS.*`.
 * @returns       Array of upload results (same order as input files).
 */
export async function uploadFilesToFTP(
    files: File[],
    folder: FTPFolder,
): Promise<FTPUploadResult[]> {
    if (files.length === 0) return [];

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('subDir', folder);

    const response = await fetch(`${API_BASE_URL}/ftp/upload-multiple`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: formData,
    });

    const raw = await parseResponse<{ files: RawFTPFileData[]; count: number }>(response);
    return raw.files.map(mapResult);
}
