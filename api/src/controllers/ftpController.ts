import "dotenv/config";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../utils/response.js";
import { ValidationError } from "../utils/errors.js";
import { uploadToFTP, testFTPConnection, listFTPFiles, deleteFromFTP } from "../services/ftp.js";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

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
        const baseName = path.basename(originalName, fileExt);
        const remoteFileName = customFileName 
            ? `${customFileName}${fileExt}`
            : `${Date.now()}-${baseName}${fileExt}`;

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
        next(error);
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
                const baseName = path.basename(file.originalname, fileExt);
                const remoteFileName = `${Date.now()}-${randomUUID().substring(0, 8)}-${baseName}${fileExt}`;

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
        next(error);
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
