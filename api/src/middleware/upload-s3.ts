import multer from "multer";
import path from "path";
import { Request } from "express";

// Memory storage for S3 uploads (files are stored in memory before uploading to S3)
const memoryStorage = multer.memoryStorage();

/**
 * File filter for product/category images
 */
const imageFileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error("Only image files (JPG, JPEG, PNG, GIF, WebP) are allowed!"));
    }
};

/**
 * File filter for order files
 */
const orderFileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    const allowedTypes = /pdf|jpg|jpeg|png|doc|docx|psd|ai/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /pdf|image|document|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/vnd\.adobe\.photoshop|application\/postscript/.test(file.mimetype);

    if (mimetype || extname) {
        return cb(null, true);
    } else {
        cb(new Error("Only PDF, image, or document files are allowed!"));
    }
};

/**
 * Multer configuration for product/category image uploads
 * - Uses memory storage (files in memory before S3 upload)
 * - Max size: 10MB
 * - Only image files allowed
 */
export const uploadImage = multer({
    storage: memoryStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: imageFileFilter,
});

/**
 * Multer configuration for order file uploads
 * - Uses memory storage (files in memory before S3 upload)
 * - Max size: 50MB
 * - PDF, images, and documents allowed
 */
export const uploadOrderFile = multer({
    storage: memoryStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: orderFileFilter,
});

