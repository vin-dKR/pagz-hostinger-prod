import "dotenv/config";
import { Client, AccessOptions } from "basic-ftp";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// FTP Configuration from environment variables or fallback to provided values
// Note: host should be just the IP or hostname, NOT a URL (no ftp:// prefix)
function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const FTP_CONFIG: AccessOptions = {
    host: requiredEnv("FTP_HOST"),
    port: parseInt(requiredEnv("FTP_PORT"), 10),
    user: requiredEnv("FTP_USER"),
    password: requiredEnv("FTP_PASSWORD"),
    secure: process.env.FTP_SECURE === "true", // Use FTPS if enabled
};

const FTP_REMOTE_DIR = process.env.FTP_REMOTE_DIR || "public_html";

// Used by controllers that accept multer "memoryStorage" and need a local path for basic-ftp.
const FTP_TEMP_DIR = path.join(process.cwd(), "uploads", "ftp-temp");

// Ensure temp directory exists
if (!fs.existsSync(FTP_TEMP_DIR)) {
    fs.mkdirSync(FTP_TEMP_DIR, { recursive: true });
}

/**
 * Upload a file to FTP server
 * @param localFilePath - Path to the local file to upload
 * @param remoteFileName - Name of the file on the FTP server
 * @param remoteSubDir - Optional subdirectory within public_html (e.g., "uploads/test")
 * @returns The full remote path of the uploaded file
 */
export async function uploadToFTP(
    localFilePath: string,
    remoteFileName: string,
    remoteSubDir?: string
): Promise<string> {
    const client = new Client();
    
    try {
        // Enable verbose logging for debugging (can be disabled in production)
        if (process.env.FTP_VERBOSE === "true") {
            client.ftp.verbose = true;
        }
        
        // Configure FTP access options with timeout
        const accessOptions: AccessOptions = {
            ...FTP_CONFIG,
            // Passive mode is enabled by default in basic-ftp, but we can ensure it
        };
        
        await client.access(accessOptions);
        
        // Get current working directory
        const pwd = await client.pwd();
        
        // If we're already in /public_html, don't try to cd into it again
        // This prevents going into /public_html/public_html
        let actualDirectory = pwd;
        
        if (pwd === '/public_html' || pwd.endsWith('/public_html')) {
            // We're already in public_html, no need to change
            actualDirectory = pwd;
        } else {
            // Try to change to public_html
            try {
                await client.cd(FTP_REMOTE_DIR);
                actualDirectory = await client.pwd();
            } catch (cdError) {
                // Try absolute path from current directory
                try {
                    const absolutePath = pwd.endsWith('/') ? `${pwd}${FTP_REMOTE_DIR}` : `${pwd}/${FTP_REMOTE_DIR}`;
                    await client.cd(absolutePath);
                    actualDirectory = await client.pwd();
                } catch (absError) {
                    // Try to create it
                    try {
                        await client.ensureDir(FTP_REMOTE_DIR);
                        await client.cd(FTP_REMOTE_DIR);
                        actualDirectory = await client.pwd();
                    } catch (createError) {
                        actualDirectory = pwd;
                    }
                }
            }
        }
        
        // If subdirectory is provided, ensure it exists and navigate into it.
        // ensureDir creates all intermediate directories as needed AND changes
        // the working directory to the target — so no extra cd() call required.
        if (remoteSubDir) {
            await client.ensureDir(remoteSubDir);
        }
        
        // Upload the file
        // Note: basic-ftp uses passive mode by default which is required for most servers
        // The timeout might be due to large files or slow connection
        const fileSize = fs.statSync(localFilePath).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        
        try {
            await client.uploadFrom(localFilePath, remoteFileName);
        } catch (uploadError) {
            const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
            console.error(`[FTP] Upload error: ${errorMsg}`);
            
            // If timeout, provide helpful message
            if (errorMsg.includes("Timeout") || errorMsg.includes("timeout")) {
                throw new Error(`Upload timed out. The file might be too large (${fileSizeMB} MB) or the connection is too slow. Try uploading a smaller file or check your network connection.`);
            }
            throw uploadError;
        }
        
        // Build the remote path (use actual directory, not necessarily FTP_REMOTE_DIR)
        const baseDir = actualDirectory === pwd ? "" : actualDirectory;
        const remotePath = remoteSubDir
            ? (baseDir ? `${baseDir}/${remoteSubDir}/${remoteFileName}` : `${remoteSubDir}/${remoteFileName}`)
            : (baseDir ? `${baseDir}/${remoteFileName}` : remoteFileName);
        
        return remotePath;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[FTP] Upload failed:`, errorMessage);
        
        // Provide more detailed error information
        if (errorMessage.includes("530")) {
            throw new Error(`FTP authentication failed. Please check your FTP username and password. Error: ${errorMessage}`);
        }
        
        throw new Error(`FTP upload failed: ${errorMessage}`);
    } finally {
        // Always close the connection
        try {
            client.close();
        } catch (closeError) {
            // Ignore close errors
        }
    }
}

/**
 * Upload an in-memory buffer to FTP by writing it to a temp file first.
 * Returns the remote path (relative to FTP_REMOTE_DIR / public_html).
 */
export async function uploadBufferToFTP(
    buffer: Buffer,
    remoteFileName: string,
    remoteSubDir?: string
): Promise<string> {
    // Create temp file with correct extension so FTP servers treat it correctly.
    const ext = path.extname(remoteFileName);
    const tempFilePath = path.join(FTP_TEMP_DIR, `${randomUUID()}${ext}`);

    try {
        fs.writeFileSync(tempFilePath, buffer);
        return await uploadToFTP(tempFilePath, remoteFileName, remoteSubDir);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[FTP] uploadBufferToFTP failed:", errorMessage);
        throw new Error(`FTP upload failed: ${errorMessage}`);
    } finally {
        try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
            // Non-critical; temp files are safe to leave in worst case.
            console.warn("[FTP] uploadBufferToFTP cleanup failed:", cleanupError);
        }
    }
}

/**
 * Test FTP connection
 * @returns true if connection is successful
 */
export async function testFTPConnection(): Promise<boolean> {
    const client = new Client();
    
    try {
        // Enable verbose logging for debugging
        if (process.env.FTP_VERBOSE === "true") {
            client.ftp.verbose = true;
        }
        
        await client.access(FTP_CONFIG);
        
        // Get current working directory
        const pwd = await client.pwd();
        
        // Try to change to public_html - try multiple approaches
        let actualDirectory = pwd;
        let foundDirectory = false;
        
        // Strategy 1: Try relative path (if we're in home directory)
        try {
            await client.cd(FTP_REMOTE_DIR);
            actualDirectory = await client.pwd(); // Get actual path
            foundDirectory = true;
        } catch (cdError) {
            // Strategy 2: Try absolute path from current directory
            try {
                const absolutePath = pwd.endsWith('/') ? `${pwd}${FTP_REMOTE_DIR}` : `${pwd}/${FTP_REMOTE_DIR}`;
                await client.cd(absolutePath);
                actualDirectory = await client.pwd();
                foundDirectory = true;
            } catch (absError) {
                // Strategy 3: Try to create it
                try {
                    await client.ensureDir(FTP_REMOTE_DIR);
                    await client.cd(FTP_REMOTE_DIR);
                    actualDirectory = await client.pwd();
                    foundDirectory = true;
                } catch (createError) {
                    // Continue with current directory - this is fine for testing
                    actualDirectory = pwd;
                }
            }
        }
        
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[FTP Test] Connection test failed:", errorMessage);
        
        // Log more details about the error
        if (errorMessage.includes("530")) {
            console.error("[FTP Test] Authentication failed - check username and password");
            console.error(`[FTP Test] Used credentials - Host: ${FTP_CONFIG.host}, User: ${FTP_CONFIG.user}`);
        } else if (errorMessage.includes("550")) {
            console.error(`[FTP Test] Directory access issue - ${FTP_REMOTE_DIR} may not exist or you may not have permissions`);
            console.error(`[FTP Test] Try checking what directories are available in your FTP account`);
        }
        
        return false;
    } finally {
        try {
            client.close();
        } catch (closeError) {
            // Ignore close errors
        }
    }
}

/**
 * List files in a remote directory
 * @param remoteSubDir - Optional subdirectory within public_html
 * @returns Array of file names
 */
export async function listFTPFiles(remoteSubDir?: string): Promise<string[]> {
    const client = new Client();
    
    try {
        await client.access(FTP_CONFIG);
        
        // Try to change to public_html, if it fails, try to create it
        try {
            await client.cd(FTP_REMOTE_DIR);
        } catch (cdError) {
            await client.ensureDir(FTP_REMOTE_DIR);
            await client.cd(FTP_REMOTE_DIR);
        }
        
        if (remoteSubDir) {
            const subDirs = remoteSubDir.split("/").filter(Boolean);
            for (const dir of subDirs) {
                await client.cd(dir);
            }
        }
        
        const files = await client.list();
        return files.map(file => file.name);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[FTP] List failed:", errorMessage);
        throw new Error(`FTP list failed: ${errorMessage}`);
    } finally {
        try {
            client.close();
        } catch (closeError) {
            // Ignore close errors
        }
    }
}

const FTP_PUBLIC_URL_BASE = process.env.FTP_PUBLIC_URL_BASE || "https://pagz.in";

/**
 * Construct a public URL from a relative FTP path.
 * If a full URL is given it is returned unchanged.
 * @param ftpPathOrUrl - e.g. "orders/abc/design.pdf" or "https://pagz.in/orders/abc/design.pdf"
 */
export function getPublicFtpUrl(ftpPathOrUrl: string): string {
    if (ftpPathOrUrl.startsWith("http://") || ftpPathOrUrl.startsWith("https://")) {
        return ftpPathOrUrl;
    }
    const cleanPath = ftpPathOrUrl.startsWith("/") ? ftpPathOrUrl.substring(1) : ftpPathOrUrl;
    return `${FTP_PUBLIC_URL_BASE}/${cleanPath}`;
}

/**
 * Extract the relative FTP path from a full URL or return the value unchanged if it
 * is already a relative path.
 * @param urlOrPath - e.g. "https://pagz.in/orders/abc/design.pdf" → "orders/abc/design.pdf"
 */
export function extractFtpPathFromUrl(urlOrPath: string): string {
    if (!urlOrPath.startsWith("http://") && !urlOrPath.startsWith("https://")) {
        return urlOrPath;
    }
    try {
        const url = new URL(urlOrPath);
        const pathname = url.pathname;
        return pathname.startsWith("/") ? pathname.substring(1) : pathname;
    } catch {
        return urlOrPath;
    }
}

function decodePathSafely(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizeRemoteDeletePath(remoteFilePath: string): string {
    const extractedPath = extractFtpPathFromUrl(remoteFilePath);
    const decodedPath = decodePathSafely(extractedPath).replace(/\\/g, "/");
    const withoutLeadingSlash = decodedPath.replace(/^\/+/, "");

    // Support values stored as "public_html/orders/..." even when current directory
    // is already inside FTP_REMOTE_DIR.
    const publicRootPrefix = `${FTP_REMOTE_DIR.replace(/^\/+|\/+$/g, "")}/`;
    if (withoutLeadingSlash.startsWith(publicRootPrefix)) {
        return withoutLeadingSlash.slice(publicRootPrefix.length);
    }

    return withoutLeadingSlash;
}

/**
 * Delete a file from FTP server
 * @param remoteFilePath - Full path to the file on FTP server (relative to public_html)
 */
export async function deleteFromFTP(remoteFilePath: string): Promise<void> {
    const client = new Client();
    
    try {
        await client.access(FTP_CONFIG);
        
        // Try to change to public_html, if it fails, try to create it
        try {
            await client.cd(FTP_REMOTE_DIR);
        } catch (cdError) {
            await client.ensureDir(FTP_REMOTE_DIR);
            await client.cd(FTP_REMOTE_DIR);
        }
        
        const cleanPath = normalizeRemoteDeletePath(remoteFilePath);
        if (!cleanPath) {
            throw new Error("Invalid FTP file path");
        }

        const currentDir = await client.pwd();
        const currentDirName = path.posix.basename(currentDir.replace(/\/+$/, ""));
        const configuredDirName = path.posix.basename(FTP_REMOTE_DIR.replace(/\/+$/, ""));

        // Try multiple variants to avoid false negatives when path includes
        // already-entered base folders such as "orders/...".
        const candidates = Array.from(
            new Set(
                [
                    cleanPath,
                    currentDirName && cleanPath.startsWith(`${currentDirName}/`)
                        ? cleanPath.slice(currentDirName.length + 1)
                        : "",
                    configuredDirName && cleanPath.startsWith(`${configuredDirName}/`)
                        ? cleanPath.slice(configuredDirName.length + 1)
                        : "",
                ].filter(Boolean)
            )
        );

        let lastError: unknown = null;
        let onlyNotFoundErrors = true;
        for (const candidate of candidates) {
            try {
                await client.remove(candidate);
                return;
            } catch (error) {
                lastError = error;
                const msg = error instanceof Error ? error.message : String(error);
                const isNotFound = msg.includes("550") && msg.toLowerCase().includes("no such file");
                if (!isNotFound) {
                    onlyNotFoundErrors = false;
                }
            }
        }

        // Deleting an already-missing file is effectively idempotent success.
        if (onlyNotFoundErrors && candidates.length > 0) {
            return;
        }

        throw lastError instanceof Error ? lastError : new Error("Unable to delete FTP file");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[FTP] Delete failed:", errorMessage);
        throw new Error(`FTP delete failed: ${errorMessage}`);
    } finally {
        try {
            client.close();
        } catch (closeError) {
            // Ignore close errors
        }
    }
}
