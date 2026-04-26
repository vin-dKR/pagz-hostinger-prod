import "dotenv/config";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../utils/response.js";
import { AppError, ValidationError } from "../utils/errors.js";
import { uploadToFTP, testFTPConnection, listFTPFiles, deleteFromFTP } from "../services/ftp.js";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

/**
 * Convert raw multer / fs / FTP-client errors into an `AppError` with a
 * meaningful message + status. The default error handler swallows
 * non-AppError exceptions as "Internal server error", which made every
 * upload failure indistinguishable on the client. By translating here
 * we surface the actual reason — file too large, name too long, FTP
 * unreachable — so the user can react.
 */
function translateUploadError(err: unknown): AppError {
    if (err instanceof AppError) return err;
    const raw = err as { message?: string; code?: string };
    const msg = String(raw?.message || err || "");
    const code = String(raw?.code || "");

    // Multer file-size limit. Multer reports as `MulterError: File too large`.
    if (msg.includes("File too large") || code === "LIMIT_FILE_SIZE") {
        return new AppError("File is too large. Max size is 100 MB per file.", 413);
    }
    // Multer field count / file count caps.
    if (code === "LIMIT_UNEXPECTED_FILE" || code === "LIMIT_FILE_COUNT") {
        return new AppError("Too many files in this upload. Try fewer files.", 400);
    }
    // Filename too long for the underlying filesystem.
    if (code === "ENAMETOOLONG" || msg.includes("name too long")) {
        return new AppError("File name is too long. Please rename it to a shorter name.", 400);
    }
    // Disk full.
    if (code === "ENOSPC") {
        return new AppError("Server storage is full. Please contact support.", 507);
    }
    // FTP layer is unreachable / timing out.
    if (
        code === "ETIMEDOUT"
        || code === "ECONNREFUSED"
        || code === "ENOTFOUND"
        || msg.includes("FTP")
        || msg.includes("ftp")
    ) {
        return new AppError(
            `Upload server temporarily unavailable. Please try again. (${msg || code || "ftp"})`,
            502,
        );
    }
    // Last resort: surface the underlying message instead of a blank 500
    // so the client at least sees what went wrong.
    return new AppError(msg || "Upload failed. Please try again.", 500);
}

const FTP_TEMP_DIR = path.join(process.cwd(), "uploads", "ftp-temp");

// FTP public URL base (for constructing public URLs to uploaded files)
const FTP_PUBLIC_URL_BASE = process.env.FTP_PUBLIC_URL_BASE || "https://pagz.in";

// Ensure temp directory exists
if (!fs.existsSync(FTP_TEMP_DIR)) {
    fs.mkdirSync(FTP_TEMP_DIR, { recursive: true });
}

/**
 * Upload a single file to FTP server
 * POST /api/v1/ftp/upload
 */
/**
 * Build a safe FTP-friendly filename.
 *
 * Strategy:
 *   - Strip control characters and replace any chars that confuse FTP
 *     servers / URLs (`\r`, `\n`, quotes, backticks, semicolons,
 *     ampersands, hashes, question marks) with `_`.
 *   - Collapse repeated underscores so "name __ rev" doesn't become a
 *     monstrosity.
 *   - Truncate the base portion (everything before the extension) so the
 *     final `<ts>-<uuid8>-<base><ext>` stays within the 255-char limit
 *     most filesystems and the Hostinger FTP layer enforce. Reserve
 *     room for our own prefix instead of erroring out at upload time.
 */
const FTP_NAME_PREFIX_RESERVE = 13 + 1 + 8 + 1; // <ts>-<uuid8>-
const FTP_FILENAME_MAX = 200; // server limit is 255; leave headroom for the prefix

const FORBIDDEN_FILENAME_CHARS = new Set(["<", ">", ":", "\"", "/", "\\", "|", "?", "*", "&", "#", ";", "`", "'", "\r", "\n", "\t"]);

function sanitizeBaseName(baseName: string, extLen: number): string {
    let scrubbed = "";
    for (const ch of baseName) {
        const code = ch.charCodeAt(0);
        if (code < 0x20 || code === 0x7F || FORBIDDEN_FILENAME_CHARS.has(ch)) {
            scrubbed += "_";
        } else {
            scrubbed += ch;
        }
    }
    const cleaned = scrubbed.replace(/_{2,}/g, "_").replace(/^[._-]+|[._-]+$/g, "").trim();
    const safe = cleaned.length > 0 ? cleaned : "file";
    const maxBase = Math.max(8, FTP_FILENAME_MAX - FTP_NAME_PREFIX_RESERVE - extLen);
    return safe.length > maxBase ? safe.slice(0, maxBase) : safe;
}

export const uploadFileToFTP = async (req: Request, res: Response, next: NextFunction) => {
    let tempFilePath: string | null = null;
    
    try {
        if (!req.file) {
            throw new ValidationError("No file uploaded");
        }

        const remoteSubDir = req.body.subDir || "test-uploads"; // Default to test-uploads directory
        const customFileName = req.body.fileName || null;

        // Generate unique filename if not provided
        const originalName = req.file.originalname;
        const fileExt = path.extname(originalName);
        const rawBaseName = path.basename(originalName, fileExt);
        const safeBaseName = sanitizeBaseName(rawBaseName, fileExt.length);
        const remoteFileName = customFileName
            ? `${customFileName}${fileExt}`
            : `${Date.now()}-${safeBaseName}${fileExt}`;

        // Save file temporarily to disk
        const tempFileName = `${randomUUID()}${fileExt}`;
        tempFilePath = path.join(FTP_TEMP_DIR, tempFileName);
        
        fs.writeFileSync(tempFilePath, req.file.buffer);

        // Upload to FTP
        const remotePath = await uploadToFTP(tempFilePath, remoteFileName, remoteSubDir);

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        }

        // Construct the public URL
        const publicUrl = `${FTP_PUBLIC_URL_BASE}/${remotePath}`;

        return sendSuccess(
            res,
            {
                remotePath,
                remoteFileName,
                publicUrl,
                size: req.file.size,
                mimetype: req.file.mimetype,
                originalName,
            },
            "File uploaded to FTP successfully",
            201
        );
    } catch (error) {
        // Clean up temp file on error
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                console.error("Failed to cleanup temp file:", cleanupError);
            }
        }
        next(translateUploadError(error));
    }
};

/**
 * Upload multiple files to FTP server
 * POST /api/v1/ftp/upload-multiple
 */
export const uploadMultipleFilesToFTP = async (req: Request, res: Response, next: NextFunction) => {
    const tempFilePaths: string[] = [];
    
    try {
        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
            throw new ValidationError("No files uploaded");
        }

        const remoteSubDir = req.body.subDir || "test-uploads";
        
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

        const uploadResults = await Promise.all(
            files.map(async (file) => {
                const fileExt = path.extname(file.originalname);
                const rawBaseName = path.basename(file.originalname, fileExt);
                const safeBaseName = sanitizeBaseName(rawBaseName, fileExt.length);
                const remoteFileName = `${Date.now()}-${randomUUID().substring(0, 8)}-${safeBaseName}${fileExt}`;

                // Save file temporarily
                const tempFileName = `${randomUUID()}${fileExt}`;
                const tempFilePath = path.join(FTP_TEMP_DIR, tempFileName);
                tempFilePaths.push(tempFilePath);
                
                fs.writeFileSync(tempFilePath, file.buffer);

                // Upload to FTP
                const remotePath = await uploadToFTP(tempFilePath, remoteFileName, remoteSubDir);

                // Clean up temp file
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }

                const publicUrl = `${FTP_PUBLIC_URL_BASE}/${remotePath}`;

                return {
                    remotePath,
                    remoteFileName,
                    publicUrl,
                    size: file.size,
                    mimetype: file.mimetype,
                    originalName: file.originalname,
                };
            })
        );

        return sendSuccess(
            res,
            {
                files: uploadResults,
                count: uploadResults.length,
            },
            `${uploadResults.length} file(s) uploaded to FTP successfully`,
            201
        );
    } catch (error) {
        // Clean up temp files on error
        tempFilePaths.forEach((tempFilePath) => {
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (cleanupError) {
                    console.error("Failed to cleanup temp file:", cleanupError);
                }
            }
        });
        next(translateUploadError(error));
    }
};

/**
 * Test FTP connection
 * GET /api/v1/ftp/test
 */
export const testFTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isConnected = await testFTPConnection();
        
        return sendSuccess(
            res,
            {
                connected: isConnected,
                message: isConnected 
                    ? "FTP connection successful" 
                    : "FTP connection failed",
            },
            isConnected ? "FTP connection test passed" : "FTP connection test failed",
            isConnected ? 200 : 500
        );
    } catch (error) {
        next(error);
    }
};

/**
 * List files in FTP directory
 * GET /api/v1/ftp/list?subDir=test-uploads
 */
export const listFTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subDir = req.query.subDir as string | undefined;
        const files = await listFTPFiles(subDir);
        
        return sendSuccess(
            res,
            {
                files,
                count: files.length,
                directory: subDir || "public_html",
            },
            "Files listed successfully"
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Delete file from FTP
 * DELETE /api/v1/ftp/delete/:filePath
 */
export const deleteFTPFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filePath = req.params.filePath as string;
        
        if (!filePath) {
            throw new ValidationError("File path is required");
        }

        await deleteFromFTP(filePath);
        
        return sendSuccess(
            res,
            null,
            "File deleted from FTP successfully"
        );
    } catch (error) {
        next(error);
    }
};
