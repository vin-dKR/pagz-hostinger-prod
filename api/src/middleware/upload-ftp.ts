import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { ValidationError } from "../utils/errors.js";

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

/**
 * Reusable middleware: reject any 0-byte file that multer just parsed.
 *
 * Multer's `fileFilter` runs before the stream finishes, so `file.size`
 * is unreliable there. By the time we hit the next middleware, every
 * file has its final `size` populated (memory storage) or `size` on the
 * fs entry (disk storage). Checking here is the single reliable choke
 * point for "user selected an empty file" on the server side, regardless
 * of whether the client-side guard runs.
 *
 * Apply after the multer middleware on every upload route. Works with
 * `single()`, `array()`, and `fields()` shapes.
 */
export const rejectEmptyFiles = (
    req: Request,
    _res: Response,
    next: NextFunction,
): void => {
    const collected: Express.Multer.File[] = [];
    if (req.file) collected.push(req.file);
    if (Array.isArray(req.files)) {
        collected.push(...req.files);
    } else if (req.files && typeof req.files === "object") {
        for (const list of Object.values(req.files)) {
            if (Array.isArray(list)) collected.push(...list);
        }
    }

    const empty = collected.filter((f) => !f || f.size === 0);
    if (empty.length > 0) {
        const names = empty.map((f) => f?.originalname || "<unnamed>").join(", ");
        next(
            new ValidationError(
                `Empty file(s) detected: ${names}. Please re-select the file(s) and try again.`,
            ),
        );
        return;
    }

    next();
};
