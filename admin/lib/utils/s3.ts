/**
 * S3 Utility Functions
 * Helper functions for working with S3 URLs and keys
 */

/**
 * Get public S3 URL from an S3 key or URL
 * If the input is already a full URL, return it as-is
 * Otherwise, construct the public S3 URL using the S3 bucket and region
 */
export function getPublicS3Url(s3KeyOrUrl: string): string {
    // If it's already a full URL, return it as-is
    if (s3KeyOrUrl.startsWith('http://') || s3KeyOrUrl.startsWith('https://')) {
        return s3KeyOrUrl;
    }

    // Get S3 bucket and region from environment variables
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET || process.env.S3_BUCKET;
    const region = process.env.NEXT_PUBLIC_S3_REGION || process.env.S3_REGION || 'us-east-1';

    if (!bucket) {
        console.warn('S3 bucket not configured. Using key as-is.');
        return s3KeyOrUrl;
    }

    // Construct public S3 URL
    // Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
    // Or: https://s3.{region}.amazonaws.com/{bucket}/{key}
    return `https://${bucket}.s3.${region}.amazonaws.com/${s3KeyOrUrl}`;
}

/**
 * Check if a file is an image based on its URL or key
 */
export function isImageFile(urlOrKey: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowercased = urlOrKey.toLowerCase();
    return imageExtensions.some(ext => lowercased.endsWith(ext));
}

/**
 * Get filename from S3 key
 */
export function getFilenameFromS3Key(s3Key: string): string {
    // Remove any path prefixes and return just the filename
    const parts = s3Key.split('/');
    return parts[parts.length - 1] || s3Key;
}
