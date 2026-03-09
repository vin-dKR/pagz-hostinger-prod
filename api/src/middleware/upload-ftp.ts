import multer from "multer";
import path from "path";
import { Request } from "express";

// Disk storage for FTP uploads (files saved temporarily before uploading to FTP)
const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadPath = path.join(process.cwd(), "uploads", "ftp-temp");
        cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
});

// Memory storage (alternative - files in memory before FTP upload)
const memoryStorage = multer.memoryStorage();

/**
 * File filter for FTP uploads (accepts all file types)
 */
const ftpFileFilter = (
    _req: Request,
    _file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    // Accept all file types for FTP uploads
    cb(null, true);
};

/**
 * Multer configuration for FTP file uploads
 * - Uses memory storage (files in memory before FTP upload)
 * - Max size: 100MB
 * - Accepts all file types
 */
export const uploadFTPFile = multer({
    storage: memoryStorage, // Use memory storage, we'll write to disk in controller if needed
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: ftpFileFilter,
});
