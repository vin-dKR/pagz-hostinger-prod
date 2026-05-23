import "dotenv/config";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../utils/response.js";
import { AppError, ValidationError } from "../utils/errors.js";
import { uploadToFTP, testFTPConnection, listFTPFiles, deleteFromFTP } from "../services/ftp.js";
import { isFtpPathReferenced } from "../utils/ftp-reference.js";
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
// Most filesystems (ext4 / Hostinger / NTFS short-name) cap individual
// filenames at 255 bytes. Leave a 5-byte safety margin for any URL
// percent-encoding the FTP server itself might add when responding.
const FTP_NAME_PREFIX_RESERVE = 13 + 1 + 8 + 1; // <ts>-<uuid8>-
const FTP_FILENAME_MAX = 250;

// Reduce the source name to a strict URL-safe ASCII subset before it ever
// reaches FTP. Anything outside `[A-Za-z0-9._-]` gets collapsed so the
// resulting public URL needs no percent-encoding — that was the failure
// mode where `MarketixMind%20DM…pdf` got double-encoded round-tripping
// through `new URL().pathname` and 404'd in the admin viewer.
function sanitizeBaseName(baseName: string, extLen: number): string {
    // 1. Decode any pre-encoded sequences (browsers sometimes send
    //    `%20` in multipart filenames). Tolerate malformed input.
    let decoded = baseName;
    try { decoded = decodeURIComponent(baseName); } catch { /* keep raw */ }
    // 2. Replace anything outside the safe set with `_`.
    const scrubbed = decoded.replace(/[^A-Za-z0-9._-]+/g, "_");
    // 3. Collapse `_` runs and trim leading/trailing punctuation.
    const cleaned = scrubbed.replace(/_{2,}/g, "_").replace(/^[._-]+|[._-]+$/g, "").trim();
    const safe = cleaned.length > 0 ? cleaned : "file";
    const maxBase = Math.max(8, FTP_FILENAME_MAX - FTP_NAME_PREFIX_RESERVE - extLen);
    return safe.length > maxBase ? safe.slice(0, maxBase) : safe;
}

// Custom file names supplied by clients (e.g. `customFileName` body field)
// must run through the same scrub before being concatenated into the
// remote name — otherwise a caller could pass spaces / `%XX` and bypass
// the sanitizer.
function sanitizeCustomFileName(name: string, extLen: number): string {
    return sanitizeBaseName(name, extLen);
}

// Extensions are short and almost always alphanumeric, but a malformed
// upload could still ship with `.pd f` or similar. Strip the leading `.`,
// scrub, then re-prepend.
function sanitizeExt(ext: string): string {
    if (!ext) return "";
    const trimmed = ext.startsWith(".") ? ext.slice(1) : ext;
    const safe = trimmed.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
    return safe ? `.${safe}` : "";
}

/**
 * Final safety cap on the constructed remote name. Filesystems / FTP
 * servers typically reject names > 255 bytes — sanitizeBaseName already
 * trims the source segment, but call sites concatenate prefixes (`<ts>-`,
 * `<ts>-<uuid8>-`) that can push the total over the cap on
 * pathological inputs (300+ char originalname, custom filename, etc.).
 * This belt-and-braces step trims the *base* portion of the final name
 * so the suffix (`.<ext>`) is preserved — chopping the extension would
 * confuse Content-Type sniffing on the served file.
 */
function capRemoteFileName(name: string): string {
    if (name.length <= FTP_FILENAME_MAX) return name;
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    const room = FTP_FILENAME_MAX - ext.length;
    const trimmedBase = base.slice(0, Math.max(1, room));
    return `${trimmedBase}${ext}`;
}

export const uploadFileToFTP = async (req: Request, res: Response, next: NextFunction) => {
    let tempFilePath: string | null = null;
    // Tracked across the request lifetime so we can clean up an orphan
    // FTP file when the client cancels mid-stream.
    //
    // Use `res.on('close')` + `res.writableEnded` to detect
    // "client disconnected before response was sent". `req.on('close')`
    // is unreliable here — Node also emits it after normal completion
    // and HTTP keep-alive timing, so guarding only with a `responseSent`
    // flag races with the happy path and could mark non-aborted
    // requests as aborted (which left 1.5MB uploads hanging because
    // sendSuccess was skipped).
    let uploadedRemotePath: string | null = null;
    let clientAborted = false;

    const runOrphanCleanup = (path: string, source: string) => {
        deleteFromFTP(path).then(
            () => console.warn(`[FTP] aborted upload cleanup ok (${source}): ${path}`),
            (err) => console.error(`[FTP] aborted upload cleanup failed (${source}): ${path}`, err),
        );
    };

    res.on("close", () => {
        // `writableEnded` is true iff res.end() was called — i.e. the
        // happy path already wrote the response. Anything else is an
        // early client disconnect.
        if (res.writableEnded) return;
        clientAborted = true;
        if (uploadedRemotePath) {
            runOrphanCleanup(uploadedRemotePath, "close-handler");
        }
        // Else: post-upload check picks it up once the path is known.
    });

    try {
        if (!req.file) {
            throw new ValidationError("No file uploaded");
        }

        const remoteSubDir = req.body.subDir || "test-uploads"; // Default to test-uploads directory
        const customFileName = req.body.fileName || null;

        // Generate unique filename if not provided
        const originalName = req.file.originalname;
        const rawExt = path.extname(originalName);
        const safeExt = sanitizeExt(rawExt);
        const rawBaseName = path.basename(originalName, rawExt);
        const safeBaseName = sanitizeBaseName(rawBaseName, safeExt.length);
        const remoteFileName = capRemoteFileName(
            customFileName
                ? `${sanitizeCustomFileName(String(customFileName), safeExt.length)}${safeExt}`
                : `${Date.now()}-${safeBaseName}${safeExt}`
        );

        // Save file temporarily to disk
        const tempFileName = `${randomUUID()}${safeExt}`;
        tempFilePath = path.join(FTP_TEMP_DIR, tempFileName);

        fs.writeFileSync(tempFilePath, req.file.buffer);

        // Upload to FTP
        uploadedRemotePath = await uploadToFTP(tempFilePath, remoteFileName, remoteSubDir);

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        }

        // If the client aborted while uploadToFTP was running, the
        // close-handler had no path to delete. Now that we have it,
        // do the cleanup and bail out without trying to send the
        // response (socket is already gone).
        if (clientAborted) {
            runOrphanCleanup(uploadedRemotePath, "post-upload");
            return;
        }

        // Construct the public URL
        const publicUrl = `${FTP_PUBLIC_URL_BASE}/${uploadedRemotePath}`;

        return sendSuccess(
            res,
            {
                remotePath: uploadedRemotePath,
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
        // If the client already disconnected, don't bother forwarding
        // to the error handler — there's nothing to send to.
        if (clientAborted) return;
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

        // Use `allSettled` so one failed file doesn't abort the rest of
        // the batch — the previous `Promise.all` rejected on the first
        // error and left successful siblings as orphans on the FTP
        // server. Successes and failures are returned separately so the
        // client can show per-file status and re-try only the failed
        // entries.
        const settled = await Promise.allSettled(
            files.map(async (file) => {
                const rawExt = path.extname(file.originalname);
                const safeExt = sanitizeExt(rawExt);
                const rawBaseName = path.basename(file.originalname, rawExt);
                const safeBaseName = sanitizeBaseName(rawBaseName, safeExt.length);
                const remoteFileName = capRemoteFileName(
                    `${Date.now()}-${randomUUID().substring(0, 8)}-${safeBaseName}${safeExt}`
                );

                // Save file temporarily
                const tempFileName = `${randomUUID()}${safeExt}`;
                const tempFilePath = path.join(FTP_TEMP_DIR, tempFileName);
                tempFilePaths.push(tempFilePath);

                fs.writeFileSync(tempFilePath, file.buffer);

                try {
                    // Upload to FTP (post-upload size check happens inside)
                    const remotePath = await uploadToFTP(tempFilePath, remoteFileName, remoteSubDir);

                    const publicUrl = `${FTP_PUBLIC_URL_BASE}/${remotePath}`;

                    return {
                        remotePath,
                        remoteFileName,
                        publicUrl,
                        size: file.size,
                        mimetype: file.mimetype,
                        originalName: file.originalname,
                    };
                } finally {
                    // Always clean up the local temp file, even on failure,
                    // so a partial batch failure doesn't leak disk.
                    if (fs.existsSync(tempFilePath)) {
                        try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
                    }
                }
            })
        );

        type UploadedFile = {
            remotePath: string;
            remoteFileName: string;
            publicUrl: string;
            size: number;
            mimetype: string;
            originalName: string;
        };

        const uploadResults: UploadedFile[] = settled
            .filter((r): r is PromiseFulfilledResult<UploadedFile> => r.status === "fulfilled")
            .map((r) => r.value);

        const failures = settled
            .map((r, idx) => ({ r, idx }))
            .filter(({ r }) => r.status === "rejected")
            .map(({ r, idx }) => {
                const reason = (r as PromiseRejectedResult).reason;
                const message = reason instanceof Error ? reason.message : String(reason);
                const originalName = files[idx]?.originalname ?? "<unknown>";
                console.error(`[FTP] upload failed for "${originalName}":`, message);
                return { originalName, error: message };
            });

        if (uploadResults.length === 0) {
            // Whole batch failed — surface a single error to the client.
            const message =
                failures.length === 1 && failures[0]
                    ? `Upload failed for "${failures[0].originalName}": ${failures[0].error}`
                    : `All ${files.length} file(s) failed to upload.`;
            throw new AppError(message, 400);
        }

        // Match `sendSuccess` convention (no 207). Mixed-result batches
        // return 201 with `failures` populated; clients should always
        // check `failures.length`.
        return sendSuccess(
            res,
            {
                files: uploadResults,
                count: uploadResults.length,
                failures,
                partial: failures.length > 0,
            },
            failures.length > 0
                ? `${uploadResults.length} of ${files.length} file(s) uploaded; ${failures.length} failed.`
                : `${uploadResults.length} file(s) uploaded to FTP successfully`,
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
 * Folders that the public DELETE endpoint is allowed to touch. Matches
 * the FTP_FOLDERS the public upload endpoints can write to, so the
 * cleanup surface area equals the upload surface area.
 */
const DELETE_ALLOWED_FOLDERS = ["orders", "reviews", "templates", "uploads"];

function isDeletePathAllowed(rawPath: string): boolean {
    // Strip leading `public_html/` and leading slashes the same way
    // normalizeRemoteDeletePath does, then check the first segment.
    const path = rawPath
        .replace(/^\/+/, "")
        .replace(/^public_html\//, "");
    if (path.includes("..")) return false;
    const firstSegment = path.split("/")[0] ?? "";
    return firstSegment.length > 0 && DELETE_ALLOWED_FOLDERS.includes(firstSegment);
}

/**
 * Delete file from FTP
 * DELETE /api/v1/ftp/delete/:filePath
 *
 * Public — matches the public upload routes. Restricted to the upload
 * folders (orders/, reviews/, etc.) so an attacker can't wipe arbitrary
 * paths under public_html. Path traversal (`..`) blocked.
 */
export const deleteFTPFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filePath = req.params.filePath as string;

        if (!filePath) {
            throw new ValidationError("File path is required");
        }

        if (!isDeletePathAllowed(filePath)) {
            throw new ValidationError(
                `Delete not allowed for this path. Allowed folders: ${DELETE_ALLOWED_FOLDERS.join(", ")}`,
            );
        }

        // Issue #86 guard — refuse to delete a file that is still referenced
        // by any CartItem or OrderItem. Without this, a user who re-uploads
        // the same file from the cart can end up with the OLDER FTP entry
        // being deleted by an unrelated cleanup path while an OrderItem
        // snapshot still references it, producing a dead URL in order
        // detail. We return 200 + a "skipped" flag so the client-side
        // bookkeeping stays consistent.
        if (await isFtpPathReferenced(filePath)) {
            console.warn(`[FTP] refused to delete referenced file: ${filePath}`);
            return sendSuccess(
                res,
                { skipped: true, reason: "referenced" },
                "File is still referenced by an active cart/order; delete skipped",
            );
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
