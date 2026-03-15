/**
 * Utility functions for S3 file handling
 */

/**
 * Get public URL from S3 key
 * Handles both full URLs and keys
 */
export function getPublicS3Url(s3KeyOrUrl: string): string {
    // If it's already a full URL, return it
    if (s3KeyOrUrl.startsWith('http://') || s3KeyOrUrl.startsWith('https://')) {
        return s3KeyOrUrl;
    }

    // Otherwise, construct the public URL
    // Based on the error URL, bucket is pagz-files and region is ap-south-1
    const bucketName = 'pagz-files';
    const region = 'ap-south-1';

    // Remove leading slash if present
    const key = s3KeyOrUrl.startsWith('/') ? s3KeyOrUrl.substring(1) : s3KeyOrUrl;

    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Check if a file is an image based on its extension or MIME type
 */
export function isImageFile(filenameOrUrl: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lower = filenameOrUrl.toLowerCase();

    // Check extension
    const hasImageExtension = imageExtensions.some(ext => lower.endsWith(ext));
    if (hasImageExtension) {
        return true;
    }

    // Check if it's a common image path pattern
    if (lower.includes('/images/') || lower.includes('image')) {
        return true;
    }

    return false;
}

/**
 * Extract filename from S3 key or URL
 */
export function getFilenameFromS3Key(s3KeyOrUrl: string): string {
    // Remove query parameters
    const withoutQuery = s3KeyOrUrl.split('?')[0] || s3KeyOrUrl;

    // Extract filename from path
    const parts = withoutQuery.split('/');
    return parts[parts.length - 1] || 'file';
}

/**
 * Extract S3 key from a full S3 URL or return the key if already a key
 * @param urlOrKey - Full S3 URL or S3 key
 * @returns S3 key
 */
export function extractS3KeyFromUrl(urlOrKey: string): string {
    // If it's already a key (doesn't start with http), return as-is
    if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
        return urlOrKey;
    }

    // Extract key from S3 URL pattern: https://bucket.s3.region.amazonaws.com/key
    const s3UrlPattern = /https?:\/\/[^/]+\.s3[.-][^/]+\.amazonaws\.com\/(.+)/;
    const match = urlOrKey.match(s3UrlPattern);
    
    const matchedKey = match?.[1];
    if (matchedKey) {
        // Remove query parameters if any
        // split always returns at least one element, so [0] is always defined
        return (matchedKey.split('?')[0] as string);
    }

    // If pattern doesn't match, try to extract from any URL path
    try {
        const url = new URL(urlOrKey);
        // Remove leading slash from pathname
        return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
    } catch {
        // If URL parsing fails, return as-is
        return urlOrKey;
    }
}
