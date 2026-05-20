import "dotenv/config";
import { Client, AccessOptions } from "basic-ftp";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ValidationError } from "../utils/errors.js";

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

/**
 * Navigate the client into the public root (FTP_REMOTE_DIR).
 *
 * Hostinger lands the FTP user in `/public_html` already — a blind
 * `cd FTP_REMOTE_DIR` then creates `/public_html/public_html` via
 * `ensureDir` and the rest of the session operates on the phantom
 * subtree (uploads land in real `/public_html/orders/`, deletes look
 * in phantom `/public_html/public_html/orders/`, etc.). Other hosts
 * land in `/`, in which case we do need the cd.
 *
 * Returns the resulting `pwd()` so callers can log / verify.
 */
async function enterPublicRoot(client: Client): Promise<string> {
    const currentPwd = await client.pwd();

    // Already in the public root → no-op. Match by either exact path or
    // by the trailing segment so both `/public_html` and a chrooted
    // `/home/user/public_html` are accepted.
    const target = FTP_REMOTE_DIR.replace(/^\/+|\/+$/g, "");
    if (currentPwd === `/${target}` || currentPwd.endsWith(`/${target}`)) {
        return currentPwd;
    }

    try {
        await client.cd(FTP_REMOTE_DIR);
        return await client.pwd();
    } catch {
        // Absolute-path form relative to login dir.
        try {
            const absolutePath = currentPwd.endsWith("/")
                ? `${currentPwd}${target}`
                : `${currentPwd}/${target}`;
            await client.cd(absolutePath);
            return await client.pwd();
        } catch {
            // Last resort: create it. Only safe to create the bare
            // FTP_REMOTE_DIR — never the absolute combined path, because
            // that's how `/public_html/public_html` was getting created.
            try {
                await client.ensureDir(FTP_REMOTE_DIR);
                return await client.pwd();
            } catch {
                return currentPwd;
            }
        }
    }
}

// Ensure temp directory exists
if (!fs.existsSync(FTP_TEMP_DIR)) {
    fs.mkdirSync(FTP_TEMP_DIR, { recursive: true });
}

/**
 * Best-effort remote file size lookup.
 *
 * `basic-ftp`'s `client.size()` issues a `SIZE` command, which a handful of
 * FTP servers (including some Hostinger configurations on ASCII mode) will
 * reject with a 550 / 502. In that case we fall back to listing the parent
 * directory and reading the size from the matching entry. Returns `null`
 * if both strategies fail — callers treat `null` as "could not verify".
 */
async function getRemoteFileSize(client: Client, remoteFileName: string): Promise<number | null> {
    try {
        const size = await client.size(remoteFileName);
        if (typeof size === "number" && Number.isFinite(size)) {
            return size;
        }
    } catch {
        // Fall through to list-based fallback.
    }

    try {
        const entries = await client.list();
        const match = entries.find((e) => e.name === remoteFileName);
        if (match && typeof match.size === "number" && Number.isFinite(match.size)) {
            return match.size;
        }
    } catch {
        // Swallow — return null below.
    }

    return null;
}

/**
 * Remove a remote file, swallowing errors. Used during cleanup after a
 * failed size verification — we don't want a secondary FTP error to
 * mask the original failure reason for the caller.
 */
async function safeRemoveRemote(client: Client, remoteFileName: string): Promise<void> {
    try {
        await client.remove(remoteFileName);
    } catch (removeError) {
        console.warn(
            `[FTP] Failed to cleanup truncated upload "${remoteFileName}":`,
            removeError instanceof Error ? removeError.message : removeError,
        );
    }
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
        const localStat = fs.statSync(localFilePath);
        const localSize = localStat.size;
        const fileSizeMB = (localSize / (1024 * 1024)).toFixed(2);

        // Defence-in-depth: refuse to start a transfer if the source is
        // already empty. Without this, basic-ftp will happily upload a
        // 0-byte file and `uploadFrom` reports success.
        if (localSize === 0) {
            throw new ValidationError("Refusing to upload empty file (0 bytes)");
        }

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

        // Post-upload integrity check.
        // basic-ftp's `uploadFrom` resolves successfully even when the
        // remote write is truncated (server-side rotation, half-closed
        // socket, etc.) — the bug that caused 0-byte order files in
        // production. Confirm the remote file exists and matches the
        // local byte count before declaring success; otherwise remove
        // the half-written remote file and bubble up an error so the
        // controller can convert it to a 4xx the client can retry.
        const remoteSize = await getRemoteFileSize(client, remoteFileName);
        if (remoteSize === null) {
            // Server doesn't support SIZE and we couldn't read it from
            // listings either — log + continue. Not failing closed here
            // would regress uploads on any host where neither call works;
            // the buffer/multer guards still cover the common 0-byte
            // failure mode.
            console.warn(
                `[FTP] Skipping size verification for "${remoteFileName}" — server reported neither SIZE nor a list entry.`,
            );
        } else if (remoteSize === 0 || remoteSize !== localSize) {
            await safeRemoveRemote(client, remoteFileName);
            throw new Error(
                `FTP upload integrity check failed for "${remoteFileName}": ` +
                `local=${localSize}B remote=${remoteSize}B. File removed; please retry.`,
            );
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

        // Preserve typed errors (ValidationError from the empty-buffer
        // guard etc.) — the controller maps these to a 4xx rather than 500.
        if (error instanceof ValidationError) {
            throw error;
        }

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
    // First line of defence: never even materialise the temp file for an
    // empty buffer. Without this, `fs.writeFileSync` would happily create
    // a 0-byte temp file and `uploadToFTP` would (until recently) ship it.
    if (!buffer || buffer.length === 0) {
        throw new ValidationError("Empty file buffer — refusing to upload 0-byte file");
    }

    // Create temp file with correct extension so FTP servers treat it correctly.
    const ext = path.extname(remoteFileName);
    const tempFilePath = path.join(FTP_TEMP_DIR, `${randomUUID()}${ext}`);

    try {
        fs.writeFileSync(tempFilePath, buffer);
        return await uploadToFTP(tempFilePath, remoteFileName, remoteSubDir);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[FTP] uploadBufferToFTP failed:", errorMessage);
        // Preserve typed errors (ValidationError from the buffer/local-size
        // guards, etc.) so the controller can translate them to a 4xx
        // instead of a generic 500.
        if (error instanceof ValidationError) {
            throw error;
        }
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
 * Result of verifying a single file on the FTP server.
 *
 * - `exists` is `false` when the FTP server reports the file missing (550 /
 *   "no such file"). Callers should map this to `"missing"`.
 * - `exists` is `true` with `size === 0` means the file is present but
 *   empty (the failure mode that motivated issue #56). Callers map this
 *   to `"empty"`.
 * - `exists` is `true` with `size > 0` is the happy path.
 * - When the server returns an unrelated error (transient network /
 *   permission / unsupported SIZE) we surface `error` so the caller can
 *   distinguish `"unreadable"` from `"missing"`.
 */
export interface FtpFileVerification {
    exists: boolean;
    size: number;
    error?: string;
}

/**
 * Result entry returned to clients by the cart verify-files endpoint.
 * Kept in this module so the controller and the client util share one
 * shape via the OpenAPI schema / response type.
 */
export type FtpVerifyReason = "missing" | "empty" | "unreadable";
export interface FtpVerifyInvalidEntry {
    path: string;
    reason: FtpVerifyReason;
}
export interface FtpVerifyBatchResult {
    valid: string[];
    invalid: FtpVerifyInvalidEntry[];
}

function isNotFoundFtpError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message) return false;
    const lower = message.toLowerCase();
    // basic-ftp surfaces 550 codes verbatim; Hostinger uses both
    // "No such file" and "File not found".
    return lower.includes("no such file")
        || lower.includes("file not found")
        || lower.includes("could not get file size");
}

/**
 * Probe a single remote path on an already-open FTP client. Falls back
 * from `SIZE` to a directory listing when the server rejects `SIZE` (some
 * Hostinger configs disable it in ASCII mode). Does NOT close the
 * client — callers manage the connection lifecycle so a batch verify
 * uses one connection for the whole list.
 */
async function probeFtpFile(
    client: Client,
    remotePath: string,
): Promise<FtpFileVerification> {
    const cleanPath = normalizeRemoteDeletePath(remotePath);
    if (!cleanPath) {
        return { exists: false, size: 0, error: "Empty path" };
    }

    // 1) SIZE — cheapest. If the server supports it we're done in one round-trip.
    try {
        const size = await client.size(cleanPath);
        if (typeof size === "number" && Number.isFinite(size)) {
            return { exists: true, size };
        }
    } catch (sizeError) {
        if (isNotFoundFtpError(sizeError)) {
            return { exists: false, size: 0 };
        }
        // Fall through to LIST — server may simply not implement SIZE.
    }

    // 2) LIST fallback — walks the parent directory once.
    try {
        const lastSlash = cleanPath.lastIndexOf("/");
        const parentDir = lastSlash >= 0 ? cleanPath.slice(0, lastSlash) : "";
        const fileName = lastSlash >= 0 ? cleanPath.slice(lastSlash + 1) : cleanPath;
        const entries = await client.list(parentDir || ".");
        const match = entries.find((e) => e.name === fileName);
        if (!match) {
            return { exists: false, size: 0 };
        }
        const size = typeof match.size === "number" && Number.isFinite(match.size)
            ? match.size
            : 0;
        return { exists: true, size };
    } catch (listError) {
        if (isNotFoundFtpError(listError)) {
            return { exists: false, size: 0 };
        }
        const message = listError instanceof Error ? listError.message : String(listError);
        return { exists: false, size: 0, error: message };
    }
}

/**
 * Internal: connect to FTP, `cd` into the configured public root once,
 * run `fn` with the open client, then close. All verify helpers use
 * this so we never leak connections and `FTP_REMOTE_DIR` handling stays
 * in one place.
 */
async function withFtpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client();
    try {
        if (process.env.FTP_VERBOSE === "true") {
            client.ftp.verbose = true;
        }
        await client.access(FTP_CONFIG);

        // Land in `public_html` so probe paths can be relative to the
        // public root (matching how callers store `customDesignUrl`).
        // Uses the shared helper so we don't create the phantom
        // `/public_html/public_html` subtree on Hostinger.
        await enterPublicRoot(client);

        return await fn(client);
    } finally {
        try {
            client.close();
        } catch {
            // ignore
        }
    }
}

/**
 * Verify a single file path on the FTP server. Opens its own connection
 * — for multiple paths use `verifyFTPFiles` to share one connection.
 *
 * @param remotePath - relative FTP path (e.g. "orders/abc.pdf") OR a full
 *                     public URL (https://pagz.in/...). Both are accepted.
 */
export async function verifyFTPFile(remotePath: string): Promise<FtpFileVerification> {
    if (!remotePath || typeof remotePath !== "string") {
        return { exists: false, size: 0, error: "Empty path" };
    }
    return withFtpClient((client) => probeFtpFile(client, remotePath));
}

/**
 * Batch-verify a list of file paths over a single FTP connection.
 *
 * Returns `{ valid, invalid }` where `valid` is the subset that exists
 * with `size > 0`, and `invalid` carries a structured reason per failed
 * entry so the client can render a precise toast / inline error.
 *
 * Paths are de-duplicated before probing but the response preserves
 * one entry per unique input path. Mixed full-URL + relative-path
 * arrays are accepted.
 */
export async function verifyFTPFiles(paths: string[]): Promise<FtpVerifyBatchResult> {
    const cleanedInputs: string[] = [];
    const seen = new Set<string>();
    for (const raw of paths) {
        if (typeof raw !== "string") continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        cleanedInputs.push(trimmed);
    }

    if (cleanedInputs.length === 0) {
        return { valid: [], invalid: [] };
    }

    return withFtpClient(async (client) => {
        const valid: string[] = [];
        const invalid: FtpVerifyInvalidEntry[] = [];

        // Sequential probing keeps the single FTP control channel sane —
        // basic-ftp issues commands serially per client anyway, so
        // parallelising with Promise.all would just queue them.
        for (const original of cleanedInputs) {
            const result = await probeFtpFile(client, original);
            if (result.exists && result.size > 0) {
                valid.push(original);
                continue;
            }
            const reason: FtpVerifyReason = !result.exists
                ? "missing"
                : result.size === 0
                    ? "empty"
                    : "unreadable";
            invalid.push({ path: original, reason });
        }

        return { valid, invalid };
    });
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

        // Land in the public root. Smart helper detects when we're
        // already there (Hostinger lands in /public_html on login) so
        // we don't accidentally create a phantom /public_html/public_html
        // subtree where deletes look but uploads never land.
        await enterPublicRoot(client);

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
        const triedPaths: string[] = [];
        for (const candidate of candidates) {
            triedPaths.push(candidate);
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

        // 550 not-found across all candidates: treat as idempotent
        // success — the deletion goal (file gone) is satisfied. This
        // also covers the common UX case where the user clicks remove
        // on a row whose file was already wiped by a prior session,
        // sweep, or aborted-upload cleanup. We still log loudly so prod
        // can investigate stored-path/CWD mismatches if they ever start
        // happening en masse.
        if (onlyNotFoundErrors && candidates.length > 0) {
            console.warn(
                `[FTP] delete: file already absent; treating as success. input=${remoteFilePath} tried=${JSON.stringify(triedPaths)} cwd=${currentDir}`,
            );
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
