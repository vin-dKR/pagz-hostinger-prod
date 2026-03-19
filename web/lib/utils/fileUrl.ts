/**
 * File URL Utility
 * Handles URL construction for FTP-hosted files.
 * Replaces the old S3 utility — all images are now served from the FTP/web server.
 *
 * Storage convention:
 *   - Files are stored as RELATIVE paths:  e.g. "products/12345-image.jpg"
 *   - Full URLs are built at render time:  e.g. "https://pagz.in/products/12345-image.jpg"
 *
 * Folder structure:
 *   products/   — product images
 *   categories/ — category images
 *   carousel/   — homepage carousel banners
 *   orders/     — customer design / order files
 *   reviews/    — review images
 *   templates/  — service template preview images
 */

/** Base URL for the file-hosting server (set via env var for environment flexibility). */
const UPLOADS_BASE_URL =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_UPLOADS_BASE_URL) ||
    'https://pagz.in';

/**
 * Get the public URL for a file.
 *
 * Handles three input formats:
 * 1. Relative path  → "products/image.jpg"      → "https://pagz.in/products/image.jpg"
 * 2. Full URL       → "https://pagz.in/…"       → returned as-is
 * 3. Legacy S3 URL  → "https://…amazonaws.com/…"→ returned as-is (backward compat)
 */
export function getPublicFileUrl(pathOrUrl: string): string {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        return pathOrUrl;
    }
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.substring(1) : pathOrUrl;
    return `${UPLOADS_BASE_URL}/${cleanPath}`;
}

/**
 * Extract the relative storage path from a full URL.
 *
 * Use this when saving a file URL to the database — strip the domain so the
 * path is portable across environments.
 *
 * "https://pagz.in/products/12345-image.jpg" → "products/12345-image.jpg"
 * "products/12345-image.jpg"                 → "products/12345-image.jpg" (no-op)
 */
export function extractPathFromUrl(url: string): string {
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return url; // Already a relative path
    }
    try {
        const { pathname } = new URL(url);
        return pathname.startsWith('/') ? pathname.substring(1) : pathname;
    } catch {
        return url;
    }
}

/**
 * Check if a file path/URL points to an image (by extension).
 */
export function isImageFile(pathOrUrl: string): boolean {
    if (!pathOrUrl) return false;
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif'];
    const lower = (pathOrUrl.split('?')[0] ?? '').toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Extract just the filename from a file path or URL.
 *
 * "products/12345-image.jpg"  → "12345-image.jpg"
 * "https://pagz.in/x/y.png"  → "y.png"
 */
export function getFilenameFromPath(pathOrUrl: string): string {
    if (!pathOrUrl) return 'file';
    const withoutQuery = pathOrUrl.split('?')[0] ?? pathOrUrl;
    const parts = withoutQuery.split('/');
    return parts[parts.length - 1] || 'file';
}
