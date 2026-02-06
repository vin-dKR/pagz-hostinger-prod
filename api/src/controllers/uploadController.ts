import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import {
    uploadToS3,
    deleteFromS3,
    getPublicUrl,
    generatePresignedUrl,
    generateFilename,
} from "../services/s3.js";
import { prisma } from "../services/prisma.js";
import { randomUUID } from "crypto";

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
        const productId = req.body.productId || null;

        // Generate filename
        const filename = generateFilename(req.file.originalname, "design");

        // Upload to S3 orders-file folder (permanent storage)
        const subfolder = `${userId}`;
        const key = await uploadToS3(
            req.file,
            "orders-file",
            subfolder,
            `${sessionId}-${filename}`,
            false // Private file
        );

        // Generate presigned URL for immediate access
        const presignedUrl = await generatePresignedUrl(key, 3600); // 1 hour

        // Extract page count if PDF (optional - would need pdf-lib or similar)
        let pageCount = null;
        if (req.file.mimetype === "application/pdf") {
            // TODO: Extract PDF page count if needed
            // pageCount = await extractPdfPageCount(req.file.buffer);
        }

        return sendSuccess(res, {
            key,
            url: presignedUrl,
            filename: `${sessionId}-${filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype,
            pageCount,
        }, "File uploaded successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Upload multiple order files
export const uploadOrderFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.files) {
            throw new ValidationError("No files uploaded");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        const userId = req.user.id;
        const sessionId = (req.body.sessionId as string) || randomUUID();

        // Handle both single file array and multiple files
        let files: Express.Multer.File[] = [];
        if (Array.isArray(req.files)) {
            files = req.files;
        } else if (typeof req.files === "object") {
            // Handle fieldname-based file object
            files = Object.values(req.files).flat();
        }

        if (files.length === 0) {
            throw new ValidationError("No files uploaded");
        }

        const subfolder = `${userId}`;

        const uploadResults = await Promise.all(
            files.map(async (file) => {
                const filename = generateFilename(file.originalname, "design");
                const key = await uploadToS3(
                    file,
                    "orders-file",
                    subfolder,
                    `${sessionId}-${filename}`,
                    false
                );

                const presignedUrl = await generatePresignedUrl(key, 3600);

                return {
                    key,
                    url: presignedUrl,
                    filename: `${sessionId}-${filename}`,
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
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });
            if (!product) {
                throw new NotFoundError("Product not found");
            }
        }

        // Handle both single file array and multiple files
        let files: Express.Multer.File[] = [];
        if (Array.isArray(req.files)) {
            files = req.files;
        } else if (typeof req.files === "object") {
            // Handle fieldname-based file object
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

        // Upload to S3 in reviews folder
        const subfolder = productId ? `${userId}/${productId}` : `${userId}`;
        const uploadResults = await Promise.all(
            files.map(async (file, index) => {
                const filename = generateFilename(file.originalname, "review");
                const timestamp = Date.now();
                const key = await uploadToS3(
                    file,
                    "images", // Use images folder for review images (public access)
                    `reviews/${subfolder}`,
                    `${timestamp}-${index}-${filename}`,
                    true // Public file so review images can be displayed directly
                );

                // Get public URL (since images are public)
                const publicUrl = getPublicUrl(key);

                return {
                    key,
                    url: publicUrl,
                    filename: `${timestamp}-${index}-${filename}`,
                    size: file.size,
                    mimetype: file.mimetype,
                };
            })
        );

        return sendSuccess(res, {
            files: uploadResults,
        }, "Review images uploaded successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Get order file (presigned URL)
export const getOrderFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileKey } = req.params;

        if (!fileKey) {
            throw new ValidationError("File key is required");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        // Generate presigned URL (valid for 1 hour)
        const presignedUrl = await generatePresignedUrl(fileKey, 3600);

        return sendSuccess(res, {
            url: presignedUrl,
        }, "File URL generated successfully");
    } catch (error) {
        next(error);
    }
};

// Delete order file
export const deleteOrderFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileKey } = req.params;

        if (!fileKey) {
            throw new ValidationError("File key is required");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        // Delete from S3
        await deleteFromS3(fileKey);

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

        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        // Upload to S3 in product images folder
        const filename = generateFilename(req.file.originalname, "product");
        const key = await uploadToS3(
            req.file,
            "images",
            `products/${productId}`,
            filename,
            true // public
        );

        const url = getPublicUrl(key);

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
            data: {
                productId,
                url,
                alt,
                isPrimary: isPrimaryFlag,
                displayOrder,
            },
        });

        return sendSuccess(
            res,
            {
                url,
                key,
                filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                image,
            },
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

        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

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
        let displayOrderBase = maxOrder ? maxOrder.displayOrder + 1 : 0;

        const results: {
            key: string;
            url: string;
            filename: string;
            size: number;
            mimetype: string;
            image: any;
        }[] = [];

        // Check if product already has a primary image
        const existingPrimary = await prisma.productImage.findFirst({
            where: { productId, isPrimary: true },
            select: { id: true },
        });

        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            if (!file) continue;

            const filename = generateFilename(file.originalname, "product");
            const key = await uploadToS3(
                file,
                "images",
                `products/${productId}`,
                filename,
                true
            );
            const url = getPublicUrl(key);

            const image = await prisma.productImage.create({
                data: {
                    productId,
                    url,
                    alt: null,
                    isPrimary: !existingPrimary && index === 0, // If no primary yet, make first uploaded primary
                    displayOrder: displayOrderBase + index,
                },
            });

            results.push({
                key,
                url,
                filename,
                size: file.size,
                mimetype: file.mimetype,
                image,
            });
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
        const { imageId } = req.params;

        if (!imageId) {
            throw new ValidationError("Image ID is required");
        }

        const image = await prisma.productImage.findUnique({
            where: { id: imageId },
        });

        if (!image) {
            throw new NotFoundError("Product image not found");
        }

        // Optionally delete from S3 as well if you store keys separately.
        // For now, we only delete the database record.
        await prisma.productImage.delete({
            where: { id: imageId },
        });

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

        const categoryId = (req.params.categoryId as string | undefined) || (req.body.categoryId as string | undefined);
        const alt = (req.body.alt as string | undefined) || null;
        const isPrimaryFlag = req.body.isPrimary !== undefined
            ? req.body.isPrimary === "true" || req.body.isPrimary === true
            : false;

        if (!categoryId) {
            throw new ValidationError("Category ID is required");
        }

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        const filename = generateFilename(req.file.originalname, "category");
        const key = await uploadToS3(
            req.file,
            "images",
            `categories/${categoryId}`,
            filename,
            true
        );
        const url = getPublicUrl(key);

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
            data: {
                categoryId,
                url,
                alt,
                isPrimary: isPrimaryFlag,
                displayOrder,
            },
        });

        return sendSuccess(
            res,
            {
                url,
                key,
                filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                image,
            },
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
        const { imageId } = req.params;

        if (!imageId) {
            throw new ValidationError("Image ID is required");
        }

        const image = await prisma.categoryImage.findUnique({
            where: { id: imageId },
        });

        if (!image) {
            throw new NotFoundError("Category image not found");
        }

        // Optionally delete from S3 as well if you store keys separately.
        await prisma.categoryImage.delete({
            where: { id: imageId },
        });

        return sendSuccess(res, null, "Category image deleted successfully");
    } catch (error) {
        next(error);
    }
};

// Upload files for order after order confirmation (called from frontend after payment success)
export const uploadOrderFilesAfterConfirmation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
            throw new ValidationError("No files uploaded");
        }

        if (!req.user || req.user.type !== "customer") {
            throw new ValidationError("Customer authentication required");
        }

        const orderId = req.params.orderId;
        const orderItemId = req.body.orderItemId as string | undefined;
        const productId = req.body.productId as string | undefined;
        const variantId = req.body.variantId as string | undefined;

        if (!orderId) {
            throw new ValidationError("Order ID is required");
        }

        if (!productId) {
            throw new ValidationError("Product ID is required for matching order item");
        }

        // Verify order exists, belongs to user, and payment is successful
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId: req.user.id,
                paymentStatus: "SUCCESS",
            },
            include: {
                items: true,
            },
        });

        if (!order) {
            throw new NotFoundError("Order not found, access denied, or payment not confirmed");
        }

        const userId = req.user.id;

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

        // Upload files to final order location: orders-file/{userId}/{orderId}/
        const subfolder = `${userId}/${orderId}`;
        const uploadResults = await Promise.all(
            files.map(async (file, index) => {
                const filename = generateFilename(file.originalname, "order");
                const finalFilename = `${Date.now()}-${index}-${filename}`;

                const key = await uploadToS3(
                    file,
                    "orders-file",
                    subfolder,
                    finalFilename,
                    false // Private file
                );

                return {
                    key,
                    filename: finalFilename,
                    size: file.size,
                    mimetype: file.mimetype,
                };
            })
        );

        // Extract S3 keys from upload results
        const uploadedKeys = uploadResults.map(result => result.key);

        if (uploadedKeys.length === 0) {
            throw new ValidationError("Failed to upload files");
        }

        // Find matching order item by productId and variantId
        let matchingItem = order.items.find(item => {
            const productMatch = item.productId === productId;
            const variantMatch = variantId
                ? item.variantId === variantId
                : item.variantId === null;
            return productMatch && variantMatch;
        });

        // If orderItemId is specified, use that instead
        if (orderItemId) {
            const itemById = order.items.find(item => item.id === orderItemId);
            if (itemById) {
                matchingItem = itemById;
            }
        }

        if (!matchingItem) {
            throw new NotFoundError(
                `Order item not found for product ${productId}, variant ${variantId || 'none'}`
            );
        }

        // Update order item with S3 URLs (replace existing array with new URLs)
        const presignedUrls = await Promise.all(
            uploadedKeys.map(async (key) => {
                return await generatePresignedUrl(key, 3600 * 24 * 365); // 1 year
            })
        );

        await prisma.orderItem.update({
            where: { id: matchingItem.id },
            data: {
                customDesignUrl: presignedUrls,
            },
        });

        return sendSuccess(res, {
            files: uploadResults,
            orderItemId: matchingItem.id,
        }, "Files uploaded and linked to order successfully", 201);
    } catch (error) {
        next(error);
    }
};
