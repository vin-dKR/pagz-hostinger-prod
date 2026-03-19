/**
 * @deprecated  Use `@/lib/utils/fileUrl` instead.
 *
 * This module re-exports from fileUrl.ts under the old S3 names so that
 * existing imports keep working without any changes.
 */

export {
    getPublicFileUrl  as getPublicS3Url,
    isImageFile,
    getFilenameFromPath as getFilenameFromS3Key,
} from './fileUrl';
