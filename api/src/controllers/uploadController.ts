import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../utils/response.js";
import { AppError, ValidationError, NotFoundError } from "../utils/errors.js";
import {
    uploadBufferToFTP,
    deleteFromFTP,
    getPublicFtpUrl,
    extractFtpPathFromUrl,
} from "../services/ftp.js";
import { prisma } from "../services/prisma.js";
import { isFtpPathReferenced } from "../utils/ftp-reference.js";
import { randomUUID } from "crypto";

/** Generate a filename with timestamp + random suffix.
 *  Extension is scrubbed to a strict alphanumeric subset so that names
 *  like `report (final).PDF` or `data%20.docx` do not produce URLs that
 *  need percent-encoding (which round-trips badly through `new URL()`). */
function generateFilename(originalName: string, prefix?: string): string {
    const rawExt = (originalName.split(".").pop() || "").trim();
    const ext = rawExt.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const stem = prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
    return ext ? `${stem}.${ext}` : stem;
}

/**
 * Shared shape used by every multi-file upload handler in this controller.
 *
 *   { files, failures, partial }
 *
 * - `files`    — successfully uploaded entries (same shape as before).
 * - `failures` — per-file error rows for the rejected uploads.
 * - `partial`  — `true` iff at least one of each occurred.
 *
 * Old clients that only read `files` still work; new clients can
 * surface per-file retry UI by walking `failures`.
 */
interface BatchUploadFailure {
    originalName: string;
    error: string;
}

interface BatchUploadOutput<T> {
    successes: T[];
    failures: BatchUploadFailure[];
}

/**
 * Run an async upload task over each multer file. Successes and rejections
 * are partitioned so the controller can decide whether to return success
 * (any success), 4xx (all failed), or success-with-warnings.
 *
 * Errors are logged with the offending filename so server logs remain
 * actionable when partial failures occur.
 */
async function runBatchUploads<T>(
    files: Express.Multer.File[],
    task: (file: Express.Multer.File, index: number) => Promise<T>,
): Promise<BatchUploadOutput<T>> {
    const settled = await Promise.allSettled(files.map((file, idx) => task(file, idx)));

    const successes: T[] = [];
    const failures: BatchUploadFailure[] = [];

    settled.forEach((result, idx) => {
        const file = files[idx];
        const originalName = file?.originalname ?? "<unknown>";
        if (result.status === "fulfilled") {
            successes.push(result.value);
        } else {
            const message = result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);
            console.error(`[Upload] failed for "${originalName}":`, message);
            failures.push({ originalName, error: message });
        }
    });

    return { successes, failures };
}

/**
 * If every file failed, escalate to a thrown `AppError` so the existing
 * `next(error)` chain converts it to a 4xx response. The full per-file
 * error list is included on `details` for clients that want to render
 * the breakdown.
 */
function assertAnySuccess(
    successes: unknown[],
    failures: BatchUploadFailure[],
    totalCount: number,
): void {
    if (successes.length > 0) return;
    const message = failures.length === 1 && failures[0]
        ? `Upload failed for "${failures[0].originalName}": ${failures[0].error}`
        : `All ${totalCount} file(s) failed to upload.`;
    throw new AppError(message, 400, { failures });
}

// Upload design/order file (customer)
export const uploadDesign = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new ValidationError("No file uploaded");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        const userId = req.user.id;
        const sessionId = req.body.sessionId || randomUUID();

        // Generate filename
        const filename = generateFilename(req.file.originalname, "design");
        const remoteSubDir = `orders/${userId}`;
        const remoteFileName = `${sessionId}-${filename}`;

        // Upload to FTP orders folder
        const remotePath = await uploadBufferToFTP(req.file.buffer, remoteFileName, remoteSubDir);
        const publicUrl = getPublicFtpUrl(remotePath);

        return sendSuccess(res, {
            key: remotePath,
            url: publicUrl,
            filename: remoteFileName,
            size: req.file.size,
            mimetype: req.file.mimetype,
            pageCount: null,
        }, "File uploaded successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Upload multiple order files (supports both authenticated and unauthenticated)
export const uploadOrderFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.files) {
            throw new ValidationError("No files uploaded");
        }

        const userId = req.user?.id || "guest";
        const sessionId = (req.body.sessionId as string) || randomUUID();

        // Handle both single file array and multiple files
        let files: Express.Multer.File[] = [];
        if (Array.isArray(req.files)) {
            files = req.files;
        } else if (typeof req.files === "object") {
            files = Object.values(req.files).flat();
        }

        if (files.length === 0) {
            throw new ValidationError("No files uploaded");
        }

        // Use session-based subfolder for unauthenticated users, userId for authenticated
        const subfolder = req.user?.id ? `orders/${userId}` : `orders/guest/${sessionId}`;

        // Each upload runs independently so one corrupt / failed file no
        // longer aborts the rest of the batch (which previously left
        // orphaned siblings on the FTP server).
        const { successes: uploadResults, failures } = await runBatchUploads(files, async (file) => {
            const filename = generateFilename(file.originalname, "design");
            const remoteFileName = `${sessionId}-${filename}`;
            const remotePath = await uploadBufferToFTP(file.buffer, remoteFileName, subfolder);
            const publicUrl = getPublicFtpUrl(remotePath);

            return {
                key: remotePath,
                url: publicUrl,
                filename: remoteFileName,
                // Echo back the user-facing name so clients can correlate
                // batch results to their original `File[]` even when the
                // success array is shorter than the input (partial batch).
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            };
        });

        assertAnySuccess(uploadResults, failures, files.length);

        return sendSuccess(res, {
            files: uploadResults,
            failures,
            partial: failures.length > 0,
            sessionId,
        }, failures.length > 0
            ? `${uploadResults.length} of ${files.length} file(s) uploaded; ${failures.length} failed.`
            : "Files uploaded successfully",
        201);
    } catch (error) {
        next(error);
    }
};

// Upload review images (customer)
export const uploadReviewImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.files) {
            throw new ValidationError("No files uploaded");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        const userId = req.user.id;
        const productId = req.body.productId as string | undefined;

        // Validate product exists if productId is provided
        if (productId) {
            const product = await prisma.product.findUnique({ where: { id: productId } });
            if (!product) {
                throw new NotFoundError("Product not found");
            }
        }

        // Handle both single file array and multiple files
        let files: Express.Multer.File[] = [];
        if (Array.isArray(req.files)) {
            files = req.files;
        } else if (typeof req.files === "object") {
            files = Object.values(req.files).flat();
        }

        if (files.length === 0) {
            throw new ValidationError("No files uploaded");
        }

        // Validate file count (max 5 files per review)
        if (files.length > 5) {
            throw new ValidationError("Maximum 5 files allowed per review");
        }

        // Validate file types (images or videos)
        const allowedMimeTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "video/mp4",
            "video/webm",
            "video/quicktime",
        ];
        const maxImageSize = 5 * 1024 * 1024; // 5MB
        const maxVideoSize = 50 * 1024 * 1024; // 50MB

        for (const file of files) {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                throw new ValidationError(
                    `Invalid file type: ${file.mimetype}. Only JPG, PNG, WebP images or MP4, WebM, MOV videos are allowed.`
                );
            }
            const isVideo = file.mimetype.startsWith("video/");
            const maxFileSize = isVideo ? maxVideoSize : maxImageSize;
            if (file.size > maxFileSize) {
                throw new ValidationError(
                    `File ${file.originalname} is too large. Maximum file size is ${isVideo ? "50MB" : "5MB"} for ${isVideo ? "videos" : "images"}.`
                );
            }
        }

        // Upload to FTP in reviews folder
        const subfolder = productId
            ? `reviews/${userId}/${productId}`
            : `reviews/${userId}`;

        const { successes: uploadResults, failures } = await runBatchUploads(files, async (file, index) => {
            const filename = generateFilename(file.originalname, "review");
            const remoteFileName = `${Date.now()}-${index}-${filename}`;
            const remotePath = await uploadBufferToFTP(file.buffer, remoteFileName, subfolder);
            const publicUrl = getPublicFtpUrl(remotePath);

            return {
                key: remotePath,
                url: publicUrl,
                filename: remoteFileName,
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            };
        });

        assertAnySuccess(uploadResults, failures, files.length);

        return sendSuccess(
            res,
            { files: uploadResults, failures, partial: failures.length > 0 },
            failures.length > 0
                ? `${uploadResults.length} of ${files.length} review image(s) uploaded; ${failures.length} failed.`
                : "Review images uploaded successfully",
            201,
        );
    } catch (error) {
        next(error);
    }
};

// Get order file – FTP files are public, so return direct public URL
export const getOrderFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fileKey = Array.isArray(req.params.fileKey)
            ? req.params.fileKey[0]
            : req.params.fileKey;

        if (!fileKey) {
            throw new ValidationError("File key is required");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        // FTP files are served publicly; just return the public URL
        const publicUrl = getPublicFtpUrl(extractFtpPathFromUrl(fileKey));

        return sendSuccess(res, { url: publicUrl }, "File URL generated successfully");
    } catch (error) {
        next(error);
    }
};

// Delete order file from FTP
export const deleteOrderFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fileKey = Array.isArray(req.params.fileKey)
            ? req.params.fileKey[0]
            : req.params.fileKey;

        if (!fileKey) {
            throw new ValidationError("File key is required");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        // Delete from FTP
        const ftpPath = extractFtpPathFromUrl(fileKey);

        // Issue #86 guard — never delete an FTP file that is still
        // referenced by another CartItem or any OrderItem. With the
        // dedupe path now reusing existing FTP URLs across cart lines
        // (issue #86), a user clicking "remove" on the services page
        // could otherwise yank the file out from under another line
        // that's still using it. Soft success keeps the client's local
        // bookkeeping consistent — the row disappears from the UI
        // either way; only the FTP side is preserved.
        if (await isFtpPathReferenced(ftpPath)) {
            console.warn(`[FTP] refused to delete referenced file: ${ftpPath}`);
            return sendSuccess(
                res,
                { skipped: true, reason: "referenced" },
                "File is still referenced by an active cart/order; delete skipped",
            );
        }

        await deleteFromFTP(ftpPath);

        return sendSuccess(res, null, "File deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Upload single product image
 * Used by `/admin/upload/product-image`
 */
export const uploadProductImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new ValidationError("No file uploaded");
        }

        const productId = req.body.productId as string | undefined;
        const alt = (req.body.alt as string | undefined) || null;
        const isPrimaryFlag = req.body.isPrimary !== undefined
            ? req.body.isPrimary === "true" || req.body.isPrimary === true
            : false;

        if (!productId) {
            throw new ValidationError("Product ID is required");
        }

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            throw new NotFoundError("Product not found");
        }

        // Upload to FTP in product images folder
        const filename = generateFilename(req.file.originalname, "product");
        const remotePath = await uploadBufferToFTP(req.file.buffer, filename, `images/products/${productId}`);
        const url = getPublicFtpUrl(remotePath);

        // Determine display order (append to end)
        const maxOrder = await prisma.productImage.findFirst({
            where: { productId },
            orderBy: { displayOrder: "desc" },
            select: { displayOrder: true },
        });
        const displayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;

        // If setting as primary, unset existing primary
        if (isPrimaryFlag) {
            await prisma.productImage.updateMany({
                where: { productId, isPrimary: true },
                data: { isPrimary: false },
            });
        }

        const image = await prisma.productImage.create({
            data: { productId, url, alt, isPrimary: isPrimaryFlag, displayOrder },
        });

        return sendSuccess(
            res,
            { url, key: remotePath, filename, size: req.file.size, mimetype: req.file.mimetype, image },
            "Product image uploaded successfully",
            201
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Upload multiple product images
 * Used by `/admin/upload/product-images`
 */
export const uploadProductImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.files) {
            throw new ValidationError("No files uploaded");
        }

        const productId = req.body.productId as string | undefined;
        if (!productId) {
            throw new ValidationError("Product ID is required");
        }

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            throw new NotFoundError("Product not found");
        }

        // Normalize files array
        let files: Express.Multer.File[] = [];
        if (Array.isArray(req.files)) {
            files = req.files;
        } else if (typeof req.files === "object") {
            files = Object.values(req.files).flat();
        }

        if (files.length === 0) {
            throw new ValidationError("No files uploaded");
        }

        // Get current max displayOrder to append new images
        const maxOrder = await prisma.productImage.findFirst({
            where: { productId },
            orderBy: { displayOrder: "desc" },
            select: { displayOrder: true },
        });
        const displayOrderBase = maxOrder ? maxOrder.displayOrder + 1 : 0;

        // Check if product already has a primary image
        const existingPrimary = await prisma.productImage.findFirst({
            where: { productId, isPrimary: true },
            select: { id: true },
        });

        const results: Array<{
            key: string;
            url: string;
            filename: string;
            size: number;
            mimetype: string;
            image: any;
        }> = [];

        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            if (!file) continue;

            const filename = generateFilename(file.originalname, "product");
            const remotePath = await uploadBufferToFTP(file.buffer, filename, `images/products/${productId}`);
            const url = getPublicFtpUrl(remotePath);

            const image = await prisma.productImage.create({
                data: {
                    productId,
                    url,
                    alt: null,
                    isPrimary: !existingPrimary && index === 0,
                    displayOrder: displayOrderBase + index,
                },
            });

            results.push({ key: remotePath, url, filename, size: file.size, mimetype: file.mimetype, image });
        }

        return sendSuccess(
            res,
            {
                images: results.map((r) => r.image),
                files: results.map(({ image, ...fileInfo }) => fileInfo),
            },
            "Product images uploaded successfully",
            201
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Delete product image
 * Used by `/admin/upload/product-image/:imageId`
 */
export const deleteProductImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const imageId = Array.isArray(req.params.imageId)
            ? req.params.imageId[0]
            : req.params.imageId;

        if (!imageId) {
            throw new ValidationError("Image ID is required");
        }

        const image = await prisma.productImage.findUnique({ where: { id: imageId } });
        if (!image) {
            throw new NotFoundError("Product image not found");
        }

        // Delete from FTP
        try {
            const ftpPath = extractFtpPathFromUrl(image.url);
            await deleteFromFTP(ftpPath);
        } catch (ftpError) {
            // Log but don't fail – remove DB record regardless
            console.error(`[Upload] Failed to delete product image from FTP (${image.url}):`, ftpError);
        }

        await prisma.productImage.delete({ where: { id: imageId } });

        return sendSuccess(res, null, "Product image deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Upload category image
 * Used by `/admin/upload/category-image` and `/admin/upload/category-image/:categoryId`
 */
export const uploadCategoryImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new ValidationError("No file uploaded");
        }

        const categoryId =
            (req.params.categoryId as string | undefined) ||
            (req.body.categoryId as string | undefined);
        const alt = (req.body.alt as string | undefined) || null;
        const isPrimaryFlag = req.body.isPrimary !== undefined
            ? req.body.isPrimary === "true" || req.body.isPrimary === true
            : false;

        if (!categoryId) {
            throw new ValidationError("Category ID is required");
        }

        const category = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const filename = generateFilename(req.file.originalname, "category");
        const remotePath = await uploadBufferToFTP(req.file.buffer, filename, `images/categories/${categoryId}`);
        const url = getPublicFtpUrl(remotePath);

        // Determine display order
        const maxOrder = await prisma.categoryImage.findFirst({
            where: { categoryId },
            orderBy: { displayOrder: "desc" },
            select: { displayOrder: true },
        });
        const displayOrder = maxOrder ? maxOrder.displayOrder + 1 : 0;

        // If setting as primary, unset other primary images
        if (isPrimaryFlag) {
            await prisma.categoryImage.updateMany({
                where: { categoryId, isPrimary: true },
                data: { isPrimary: false },
            });
        }

        const image = await prisma.categoryImage.create({
            data: { categoryId, url, alt, isPrimary: isPrimaryFlag, displayOrder },
        });

        return sendSuccess(
            res,
            { url, key: remotePath, filename, size: req.file.size, mimetype: req.file.mimetype, image },
            "Category image uploaded successfully",
            201
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Delete category image
 * Used by `/admin/upload/category-image/:imageId`
 */
export const deleteCategoryImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const imageId = Array.isArray(req.params.imageId)
            ? req.params.imageId[0]
            : req.params.imageId;

        if (!imageId) {
            throw new ValidationError("Image ID is required");
        }

        const image = await prisma.categoryImage.findUnique({ where: { id: imageId } });
        if (!image) {
            throw new NotFoundError("Category image not found");
        }

        // Delete from FTP
        try {
            const ftpPath = extractFtpPathFromUrl(image.url);
            await deleteFromFTP(ftpPath);
        } catch (ftpError) {
            console.error(`[Upload] Failed to delete category image from FTP (${image.url}):`, ftpError);
        }

        await prisma.categoryImage.delete({ where: { id: imageId } });

        return sendSuccess(res, null, "Category image deleted successfully");
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Upload carousel image
 * Used by `/admin/upload/carousel-image`
 */
export const uploadCarouselImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new ValidationError("No file uploaded");
        }

        const alt = (req.body.alt as string | undefined) || null;

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(req.file.mimetype)) {
            throw new ValidationError(
                "Invalid file type. Please upload JPG, PNG, WebP, or GIF images."
            );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (req.file.size > maxSize) {
            throw new ValidationError("File size must be less than 10MB.");
        }

        const filename = generateFilename(req.file.originalname, "carousel");
        const remotePath = await uploadBufferToFTP(req.file.buffer, filename, "carousel");
        const url = getPublicFtpUrl(remotePath);

        return sendSuccess(
            res,
            { url, key: remotePath, filename, size: req.file.size, mimetype: req.file.mimetype, alt },
            "Carousel image uploaded successfully",
            201
        );
    } catch (error) {
        next(error);
    }
};
