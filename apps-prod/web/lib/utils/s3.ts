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

