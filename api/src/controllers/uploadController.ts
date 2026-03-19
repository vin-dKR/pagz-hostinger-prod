import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import {
    uploadBufferToFTP,
    deleteFromFTP,
    getPublicFtpUrl,
    extractFtpPathFromUrl,
} from "../services/ftp.js";
import { prisma } from "../services/prisma.js";
import { randomUUID } from "crypto";

/** Generate a filename with timestamp + random suffix */
function generateFilename(originalName: string, prefix?: string): string {
    const ext = originalName.split(".").pop() || "";
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    return prefix
        ? `${prefix}-${timestamp}-${random}.${ext}`
        : `${timestamp}-${random}.${ext}`;
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

        const uploadResults = await Promise.all(
            files.map(async (file) => {
                const filename = generateFilename(file.originalname, "design");
                const remoteFileName = `${sessionId}-${filename}`;
                const remotePath = await uploadBufferToFTP(file.buffer, remoteFileName, subfolder);
                const publicUrl = getPublicFtpUrl(remotePath);

                return {
                    key: remotePath,
                    url: publicUrl,
                    filename: remoteFileName,
                    size: file.size,
                    mimetype: file.mimetype,
                };
            })
        );

        return sendSuccess(res, {
            files: uploadResults,
            sessionId,
        }, "Files uploaded successfully", 201);
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

        // Validate file count (max 5 images per review)
        if (files.length > 5) {
            throw new ValidationError("Maximum 5 images allowed per review");
        }

        // Validate file types (only images)
        const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        const maxFileSize = 5 * 1024 * 1024; // 5MB

        for (const file of files) {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                throw new ValidationError(
                    `Invalid file type: ${file.mimetype}. Only JPG, PNG, and WebP images are allowed.`
                );
            }
            if (file.size > maxFileSize) {
                throw new ValidationError(
                    `File ${file.originalname} is too large. Maximum file size is 5MB.`
                );
            }
        }

        // Upload to FTP in reviews folder
        const subfolder = productId
            ? `reviews/${userId}/${productId}`
            : `reviews/${userId}`;

        const uploadResults = await Promise.all(
            files.map(async (file, index) => {
                const filename = generateFilename(file.originalname, "review");
                const remoteFileName = `${Date.now()}-${index}-${filename}`;
                const remotePath = await uploadBufferToFTP(file.buffer, remoteFileName, subfolder);
                const publicUrl = getPublicFtpUrl(remotePath);

                return {
                    key: remotePath,
                    url: publicUrl,
                    filename: remoteFileName,
                    size: file.size,
                    mimetype: file.mimetype,
                };
            })
        );

        return sendSuccess(res, { files: uploadResults }, "Review images uploaded successfully", 201);
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
