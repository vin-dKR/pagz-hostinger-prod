/**
 * FTP Upload Service  (Web / Storefront)
 *
 * Centralises all file uploads for the public storefront through the FTP endpoint.
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
 *   Only the RELATIVE path is stored (e.g. "orders/12345-design.pdf").
 *   The domain is prepended at render time via `getPublicFileUrl()`.
 */

import { getAuthToken, type ApiResponse } from '../api-client';
import { extractPathFromUrl } from '../utils/fileUrl';
import { assertNonEmptyFiles } from '../utils/file-validation';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FTPUploadResult {
    /** Relative path for DB storage: "orders/12345-design.pdf" */
    path: string;
    /** Full public URL: "https://pagz.in/orders/12345-design.pdf" */
    publicUrl: string;
    /** Stored filename on the server */
    filename: string;
    size: number;
    mimetype: string;
    originalName: string;
}

/**
 * Per-file failure entry returned when a batch upload partially succeeds.
 * Mirrors the backend `failures` array from `controllers/uploadController.ts`
 * and `controllers/ftpController.ts`.
 */
export interface FTPUploadFailure {
    originalName: string;
    error: string;
}

export interface FTPMultipleUploadResult {
    files: FTPUploadResult[];
    count: number;
    /** Per-file failures (empty when every file uploaded successfully). */
    failures: FTPUploadFailure[];
    /** Convenience flag: `failures.length > 0 && files.length > 0`. */
    partial: boolean;
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

// ─── Legacy interface shapes (kept for backward compatibility) ────────────────

/** @deprecated - kept for backward compat with existing callers */
export interface FTPUploadResponse {
    remotePath: string;
    remoteFileName: string;
    publicUrl: string;
    size: number;
    mimetype: string;
    originalName: string;
}

/** @deprecated - kept for backward compat with existing callers */
export interface FTPMultipleUploadResponse {
    files: FTPUploadResult[];
    count: number;
    failures?: FTPUploadFailure[];
    partial?: boolean;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

function buildAuthHeaders(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    let data: any;

    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = {
            success: false,
            message: `Server returned ${response.status} ${response.statusText}`,
            error: text || 'Unexpected server response',
        };
    }

    if (!response.ok || data.success === false) {
        const msg = data.message || data.error || `Upload failed with status ${response.status}`;
        const err: any = new Error(msg);
        err.statusCode = response.status;
        err.errors = data.errors;
        throw err;
    }

    return data.data as T;
}

function mapResult(raw: any): FTPUploadResult {
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
 * @param file        The file to upload.
 * @param folder      Destination folder — use one of `FTP_FOLDERS.*`.
 * @param fileName    Optional custom file name (without extension).
 * @returns           Upload result with relative path + full public URL.
 *
 * @example
 *   const result = await uploadSingleFile(file, FTP_FOLDERS.ORDERS);
 *   // store result.path → "orders/1712345678-design.pdf"
 */
export async function uploadSingleFile(
    file: File,
    folder: FTPFolder,
    fileName?: string,
): Promise<FTPUploadResult> {
    // Block 0-byte files at the source — see issue #56. Throws
    // `EmptyFilesError` so callers can render a typed toast instead of
    // a generic "upload failed" once the server rejects the multipart.
    assertNonEmptyFiles([file]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('subDir', folder);
    if (fileName) formData.append('fileName', fileName);

    const response = await fetch(`${API_BASE_URL}/ftp/upload`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: formData,
    });

    const raw = await parseResponse<any>(response);
    return mapResult(raw);
}

/**
 * Upload multiple files to the FTP server in the given folder.
 *
 * @param files   Array of files to upload.
 * @param folder  Destination folder — use one of `FTP_FOLDERS.*`.
 * @returns       Array of upload results (same order as input files).
 */
export async function uploadMultipleFiles(
    files: File[],
    folder: FTPFolder,
): Promise<FTPMultipleUploadResult> {
    if (files.length === 0) return { files: [], count: 0, failures: [], partial: false };

    // Block 0-byte files at the source — see issue #56.
    assertNonEmptyFiles(files);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('subDir', folder);

    const response = await fetch(`${API_BASE_URL}/ftp/upload-multiple`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: formData,
    });

    const raw = await parseResponse<{
        files: any[];
        count: number;
        failures?: FTPUploadFailure[];
        partial?: boolean;
    }>(response);
    const mappedFiles = raw.files.map(mapResult);
    const failures = Array.isArray(raw.failures) ? raw.failures : [];

    return {
        files: mappedFiles,
        count: mappedFiles.length,
        failures,
        partial: failures.length > 0 && mappedFiles.length > 0,
    };
}

// ─── Legacy functions (preserved for backward compatibility) ─────────────────

/**
 * @deprecated Use `uploadSingleFile(file, FTP_FOLDERS.X)` instead.
 * Upload a single file to FTP server (legacy API)
 */
export async function uploadFileToFTP(
    file: File,
    subDir?: string,
    fileName?: string,
): Promise<ApiResponse<FTPUploadResponse>> {
    const folder = (subDir || 'test-uploads') as FTPFolder;
    const result = await uploadSingleFile(file, folder, fileName);

    return {
        success: true,
        data: {
            remotePath:     folder + '/',
            remoteFileName: result.filename,
            publicUrl:      result.publicUrl,
            size:           result.size,
            mimetype:       result.mimetype,
            originalName:   result.originalName,
        },
    };
}

/**
 * @deprecated Use `uploadMultipleFiles(files, FTP_FOLDERS.X)` instead.
 * Upload multiple files to FTP server (legacy API)
 */
export async function uploadMultipleFilesToFTP(
    files: File[],
    subDir?: string,
): Promise<ApiResponse<FTPMultipleUploadResponse>> {
    const folder = (subDir || 'test-uploads') as FTPFolder;
    const result = await uploadMultipleFiles(files, folder);

    return {
        success: true,
        data: {
            files: result.files,
            count: result.count,
            failures: result.failures,
            partial: result.partial,
        },
    };
}

/**
 * Test FTP connection
 */
export async function testFTPConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    const response = await fetch(`${API_BASE_URL}/ftp/test`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
    });

    const data = await response.json();

    if (!response.ok) {
        throw {
            message: data.message || data.error || 'An error occurred',
            statusCode: response.status,
        };
    }

    return data;
}

/**
 * List files in FTP directory
 */
export async function listFTPFiles(
    subDir?: string,
): Promise<ApiResponse<{ files: string[]; count: number; directory: string }>> {
    const url = subDir
        ? `${API_BASE_URL}/ftp/list?subDir=${encodeURIComponent(subDir)}`
        : `${API_BASE_URL}/ftp/list`;

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
    });

    const data = await response.json();

    if (!response.ok) {
        throw {
            message: data.message || data.error || 'An error occurred',
            statusCode: response.status,
        };
    }

    return data;
}
