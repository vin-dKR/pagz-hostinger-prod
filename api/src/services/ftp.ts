import "dotenv/config";
import { Client, AccessOptions } from "basic-ftp";
import path from "path";
import fs from "fs";

// FTP Configuration from environment variables or fallback to provided values
// Note: host should be just the IP or hostname, NOT a URL (no ftp:// prefix)
const FTP_CONFIG: AccessOptions = {
    host: process.env.FTP_HOST || "82.112.239.166",
    port: parseInt(process.env.FTP_PORT || "21", 10),
    user: process.env.FTP_USER || "u741493420.pagz.in",
    password: process.env.FTP_PASSWORD || "7488465010@Hr",
    secure: process.env.FTP_SECURE === "true", // Use FTPS if enabled
};

const FTP_REMOTE_DIR = process.env.FTP_REMOTE_DIR || "public_html";

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
        
        // Connect to FTP server with extended timeout configuration
        console.log(`[FTP] Connecting to ${FTP_CONFIG.host}:${FTP_CONFIG.port} as ${FTP_CONFIG.user}`);
        
        // Configure FTP access options with timeout
        const accessOptions: AccessOptions = {
            ...FTP_CONFIG,
            // Passive mode is enabled by default in basic-ftp, but we can ensure it
        };
        
        await client.access(accessOptions);
        console.log("[FTP] Connection successful");
        
        // Set socket timeout after connection (for long uploads)
        // Note: basic-ftp handles timeouts internally, but we can track progress
        
        // Get current working directory
        const pwd = await client.pwd();
        console.log(`[FTP] Current directory: ${pwd}`);
        
        // If we're already in /public_html, don't try to cd into it again
        // This prevents going into /public_html/public_html
        let actualDirectory = pwd;
        
        if (pwd === '/public_html' || pwd.endsWith('/public_html')) {
            // We're already in public_html, no need to change
            console.log(`[FTP] Already in ${FTP_REMOTE_DIR}, no need to change directory`);
            actualDirectory = pwd;
        } else {
            // Try to change to public_html
            try {
                await client.cd(FTP_REMOTE_DIR);
                actualDirectory = await client.pwd();
                console.log(`[FTP] Changed to directory: ${actualDirectory}`);
            } catch (cdError) {
                // Try absolute path from current directory
                try {
                    const absolutePath = pwd.endsWith('/') ? `${pwd}${FTP_REMOTE_DIR}` : `${pwd}/${FTP_REMOTE_DIR}`;
                    await client.cd(absolutePath);
                    actualDirectory = await client.pwd();
                    console.log(`[FTP] Changed to directory: ${actualDirectory}`);
                } catch (absError) {
                    // Try to create it
                    console.log(`[FTP] Directory ${FTP_REMOTE_DIR} not found, attempting to create it...`);
                    try {
                        await client.ensureDir(FTP_REMOTE_DIR);
                        await client.cd(FTP_REMOTE_DIR);
                        actualDirectory = await client.pwd();
                        console.log(`[FTP] Successfully created and changed to directory: ${actualDirectory}`);
                    } catch (createError) {
                        console.warn(`[FTP] Could not access or create directory ${FTP_REMOTE_DIR}. Using current directory: ${pwd}`);
                        actualDirectory = pwd;
                    }
                }
            }
        }
        
        // If subdirectory is provided, create it and navigate to it
        if (remoteSubDir) {
            const subDirs = remoteSubDir.split("/").filter(Boolean);
            for (const dir of subDirs) {
                try {
                    await client.cd(dir);
                } catch (error) {
                    // Directory doesn't exist, create it
                    await client.ensureDir(dir);
                    await client.cd(dir);
                }
            }
        }
        
        // Upload the file with progress tracking
        const fileSize = fs.statSync(localFilePath).size;
        const fileSizeKB = (fileSize / 1024).toFixed(2);
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        console.log(`[FTP] Starting upload of ${remoteFileName} (${fileSizeKB} KB / ${fileSizeMB} MB)`);
        
        // Upload the file
        // Note: basic-ftp uses passive mode by default which is required for most servers
        // The timeout might be due to large files or slow connection
        try {
            await client.uploadFrom(localFilePath, remoteFileName);
            console.log(`[FTP] Upload completed successfully`);
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
        
        console.log(`[FTP] File uploaded successfully: ${remotePath}`);
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
        
        console.log(`[FTP Test] Attempting to connect to ${FTP_CONFIG.host}:${FTP_CONFIG.port} as ${FTP_CONFIG.user}`);
        await client.access(FTP_CONFIG);
        console.log("[FTP Test] Connection successful");
        
        // Get current working directory
        const pwd = await client.pwd();
        console.log(`[FTP Test] Current directory: ${pwd}`);
        
        // List available files/directories in current directory
        try {
            const list = await client.list();
            console.log(`[FTP Test] Available items in current directory:`, list.map(item => item.name));
        } catch (listError) {
            console.log(`[FTP Test] Could not list directory contents`);
        }
        
        // Try to change to public_html - try multiple approaches
        let actualDirectory = pwd;
        let foundDirectory = false;
        
        // Strategy 1: Try relative path (if we're in home directory)
        try {
            await client.cd(FTP_REMOTE_DIR);
            actualDirectory = await client.pwd(); // Get actual path
            foundDirectory = true;
            console.log(`[FTP Test] ✓ Successfully changed to directory: ${actualDirectory}`);
        } catch (cdError) {
            // Strategy 2: Try absolute path from current directory
            try {
                const absolutePath = pwd.endsWith('/') ? `${pwd}${FTP_REMOTE_DIR}` : `${pwd}/${FTP_REMOTE_DIR}`;
                await client.cd(absolutePath);
                actualDirectory = await client.pwd();
                foundDirectory = true;
                console.log(`[FTP Test] ✓ Successfully changed to directory: ${actualDirectory}`);
            } catch (absError) {
                // Strategy 3: Try to create it
                console.log(`[FTP Test] Directory ${FTP_REMOTE_DIR} not found, attempting to create it...`);
                try {
                    await client.ensureDir(FTP_REMOTE_DIR);
                    await client.cd(FTP_REMOTE_DIR);
                    actualDirectory = await client.pwd();
                    foundDirectory = true;
                    console.log(`[FTP Test] ✓ Successfully created and changed to directory: ${actualDirectory}`);
                } catch (createError) {
                    console.warn(`[FTP Test] ⚠ Could not access or create directory ${FTP_REMOTE_DIR}`);
                    console.warn(`[FTP Test] Will use current directory: ${pwd}`);
                    // Continue with current directory - this is fine for testing
                    actualDirectory = pwd;
                }
            }
        }
        
        console.log(`[FTP Test] Working directory: ${actualDirectory}`);
        
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
        
        // Remove public_html prefix if present
        const cleanPath = remoteFilePath.startsWith(FTP_REMOTE_DIR + "/")
            ? remoteFilePath.substring(FTP_REMOTE_DIR.length + 1)
            : remoteFilePath;
        
        const pathParts = cleanPath.split("/");
        const fileName = pathParts.pop();
        const dirPath = pathParts.join("/");
        
        if (dirPath) {
            await client.cd(dirPath);
        }
        
        if (fileName) {
            await client.remove(fileName);
        }
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
