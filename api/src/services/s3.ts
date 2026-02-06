import "dotenv/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";
const IMAGES_FOLDER = process.env.AWS_S3_IMAGES_FOLDER || "images";
const ORDERS_FILE_FOLDER = process.env.AWS_S3_ORDERS_FILE_FOLDER || "orders-file";
// Note: IMAGES_CDN_URL is deprecated - always use direct S3 URLs
// If you need CDN, configure CloudFront in front of S3 bucket
const IMAGES_CDN_URL = process.env.AWS_S3_IMAGES_CDN_URL;

// Validate S3 configuration
if (!BUCKET_NAME || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("❌ AWS S3 configuration is incomplete!");
    console.error("Missing required environment variables:");
    if (!BUCKET_NAME) console.error("  - AWS_S3_BUCKET_NAME");
    if (!process.env.AWS_ACCESS_KEY_ID) console.error("  - AWS_ACCESS_KEY_ID");
    if (!process.env.AWS_SECRET_ACCESS_KEY) console.error("  - AWS_SECRET_ACCESS_KEY");
    console.error("\n📖 See apps/api/AWS_S3_SETUP.md for setup instructions.");
    console.error("File uploads will fail until these are configured.\n");
}

/**
 * Upload file to S3
 * @param file - File buffer or Multer file object
 * @param folder - 'images' or 'orders-file'
 * @param subfolder - Subfolder path (e.g., 'products/{productId}' or '{userId}/')
 * @param filename - Filename with extension
 * @param isPublic - Whether the file should be publicly accessible
 * @returns S3 key (path) of the uploaded file
 */
export async function uploadToS3(
    file: Buffer | Express.Multer.File,
    folder: "images" | "orders-file",
    subfolder: string,
    filename: string,
    isPublic: boolean = false
): Promise<string> {
    if (!BUCKET_NAME) {
        throw new Error("AWS S3 bucket name is not configured");
    }

    const fileBuffer = Buffer.isBuffer(file) ? file : file.buffer;
    const contentType = Buffer.isBuffer(file)
        ? "application/octet-stream"
        : (file.mimetype || "application/octet-stream");

    // Construct S3 key
    const key = `${folder}/${subfolder}/${filename}`;

    // Modern S3 buckets don't support ACLs - use bucket policies instead
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        // ACL removed - bucket policies handle access control
        // Public access is controlled via bucket policy for images/ folder
    });

    try {
        await s3Client.send(command);
        return key;
    } catch (error) {
        console.error("S3 upload error:", error);

        // Provide helpful error messages
        if (error instanceof Error) {
            if (error.message.includes("signature") || error.message.includes("InvalidAccessKeyId")) {
                throw new Error(
                    `AWS S3 authentication failed. Please check your AWS credentials:\n` +
                    `- AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be correct\n` +
                    `- See apps/api/AWS_S3_SETUP.md for setup instructions`
                );
            }
            if (error.message.includes("NoSuchBucket")) {
                throw new Error(
                    `S3 bucket "${BUCKET_NAME}" not found. Please check AWS_S3_BUCKET_NAME environment variable.`
                );
            }
            if (error.message.includes("AccessDenied")) {
                throw new Error(
                    `Access denied to S3 bucket. Please check IAM user permissions.\n` +
                    `Required permissions: s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket`
                );
            }
            if (error.message.includes("ACL") || error.message.includes("AccessControlList")) {
                throw new Error(
                    `S3 bucket ACLs are disabled (this is normal for modern buckets).\n` +
                    `Use bucket policies instead. For public images, configure bucket policy to allow public read on images/* folder.\n` +
                    `See AWS_S3_SETUP.md for bucket policy configuration.`
                );
            }
        }

        throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Delete file from S3
 * @param key - S3 key (path) of the file to delete
 */
export async function deleteFromS3(key: string): Promise<void> {
    if (!BUCKET_NAME) {
        throw new Error("AWS S3 bucket name is not configured");
    }

    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    try {
        await s3Client.send(command);
    } catch (error) {
        console.error("S3 delete error:", error);
        throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Get public URL for a file
 * @param key - S3 key (path) of the file
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
    if (!BUCKET_NAME) {
        throw new Error("AWS S3 bucket name is not configured");
    }

    const region = process.env.AWS_REGION || "us-east-1";

    // Always use S3 URL format: https://bucket-name.s3.region.amazonaws.com/key
    // CDN URL should be configured at CloudFront/CDN level, not in application code
    // This ensures we always store the correct S3 URL in the database
    return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Generate presigned URL for private file access
 * @param key - S3 key (path) of the file
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function generatePresignedUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    if (!BUCKET_NAME) {
        throw new Error("AWS S3 bucket name is not configured");
    }

    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    try {
        const url = await getSignedUrl(s3Client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error("S3 presigned URL error:", error);
        throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Copy file from one location to another in S3
 * @param sourceKey - Source S3 key
 * @param destinationKey - Destination S3 key
 * @param isPublic - Whether the destination file should be publicly accessible
 */
export async function copyFile(
    sourceKey: string,
    destinationKey: string,
    isPublic: boolean = false
): Promise<void> {
    if (!BUCKET_NAME) {
        throw new Error("AWS S3 bucket name is not configured");
    }

    // Modern S3 buckets don't support ACLs - use bucket policies instead
    const command = new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${sourceKey}`,
        Key: destinationKey,
        // ACL removed - bucket policies handle access control
        // Public access is controlled via bucket policy for images/ folder
    });

    try {
        await s3Client.send(command);
    } catch (error) {
        console.error("S3 copy error:", error);
        throw new Error(`Failed to copy file in S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Extract S3 key from URL
 * @param url - S3 URL or CDN URL
 * @returns S3 key or null if not a valid S3 URL
 */
export function extractKeyFromUrl(url: string): string | null {
    // Try to extract from S3 URL (primary method)
    const s3UrlPattern = new RegExp(`https://${BUCKET_NAME}\\.s3[.-]([^.]+)\\.amazonaws\\.com/(.+)`);
    const match = url.match(s3UrlPattern);
    if (match && match[2]) {
        return match[2];
    }

    // Try to extract from CDN URL (legacy support)
    if (IMAGES_CDN_URL && url.startsWith(IMAGES_CDN_URL)) {
        const relativePath = url.replace(IMAGES_CDN_URL + "/", "");
        return `${IMAGES_FOLDER}/${relativePath}`;
    }

    // If it's already a key (starts with folder name)
    if (url.startsWith(`${IMAGES_FOLDER}/`) || url.startsWith(`${ORDERS_FILE_FOLDER}/`)) {
        return url;
    }

    return null;
}

/**
 * Generate filename with timestamp
 * @param originalName - Original filename
 * @param prefix - Optional prefix (e.g., 'primary', 'image', 'design')
 * @returns Generated filename
 */
export function generateFilename(originalName: string, prefix?: string): string {
    const ext = originalName.split(".").pop() || "";
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const name = prefix ? `${prefix}-${timestamp}-${random}.${ext}` : `${timestamp}-${random}.${ext}`;
    return name;
}

/**
 * Get folder constants
 */
export const S3_FOLDERS = {
    IMAGES: IMAGES_FOLDER,
    ORDERS_FILE: ORDERS_FILE_FOLDER,
} as const;

