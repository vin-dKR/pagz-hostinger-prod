/**
 * File Validation Utilities
 * Reusable utilities for file type, size, and page count validation.
 *
 * The `assertNonEmptyFiles` helper + `EmptyFilesError` are the single
 * client-side choke point for 0-byte uploads. Every upload entry point
 * (TemplateForm, lib/api/ftp.ts, lib/api/uploads.ts, …) should call it
 * BEFORE building FormData so the user gets immediate feedback instead
 * of waiting for the server to reject the multipart payload. See
 * GitHub issue #56 for the layered-defence design.
 */

/**
 * Thrown by `assertNonEmptyFiles` when one or more selected files are 0
 * bytes. The `.fileNames` array lets the UI list every offender at once
 * rather than failing on the first.
 */
export class EmptyFilesError extends Error {
    readonly fileNames: string[];

    constructor(fileNames: string[]) {
        const summary = fileNames.length === 1
            ? `"${fileNames[0]}"`
            : `${fileNames.length} files (${fileNames.map((n) => `"${n}"`).join(', ')})`;
        super(`${summary} is empty. Please re-select the file(s) and try again.`);
        this.name = 'EmptyFilesError';
        this.fileNames = fileNames;
    }
}

/**
 * Reject any selected file with `size === 0` before it ever hits the
 * network. The check is deliberately strict — a 0-byte file is almost
 * always a broken drag-drop / cancelled-download artifact and the user
 * benefits from an immediate, file-specific error rather than a generic
 * server rejection after the upload round-trip.
 *
 * @throws {EmptyFilesError} if any file is empty.
 */
export function assertNonEmptyFiles(files: File[]): void {
    const empties = files.filter((f) => !f || f.size === 0);
    if (empties.length > 0) {
        throw new EmptyFilesError(empties.map((f) => f?.name || 'unnamed'));
    }
}

// Supported file types
export const ALLOWED_FILE_TYPES = {
    images: ['image/jpeg', 'image/jpg', 'image/png'],
    pdf: ['application/pdf'],
    all: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
} as const;

export const ALLOWED_FILE_EXTENSIONS = {
    images: ['.jpg', '.jpeg', '.png'],
    pdf: ['.pdf'],
    all: ['.jpg', '.jpeg', '.png', '.pdf'],
} as const;

/**
 * Validates if a file type is allowed (JPG, PNG, PDF only)
 */
export function isValidFileType(file: File): boolean {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    // Check MIME type
    const isValidMimeType = ALLOWED_FILE_TYPES.all.some(
        (allowedType) => fileType === allowedType
    );
    
    // Check file extension as fallback
    const isValidExtension = ALLOWED_FILE_EXTENSIONS.all.some(
        (ext) => fileName.endsWith(ext)
    );
    
    return isValidMimeType || isValidExtension;
}

/**
 * Gets the file type category (image or pdf)
 */
export function getFileType(file: File): 'image' | 'pdf' | 'invalid' {
    if (!isValidFileType(file)) {
        return 'invalid';
    }
    
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    if (
        ALLOWED_FILE_TYPES.images.some((type) => fileType === type) ||
        ALLOWED_FILE_EXTENSIONS.images.some((ext) => fileName.endsWith(ext))
    ) {
        return 'image';
    }
    
    if (
        fileType === ALLOWED_FILE_TYPES.pdf[0] ||
        fileName.endsWith(ALLOWED_FILE_EXTENSIONS.pdf[0])
    ) {
        return 'pdf';
    }
    
    return 'invalid';
}

/**
 * Validates multiple files and returns validation result
 */
export interface FileValidationResult {
    valid: boolean;
    invalidFiles: Array<{ file: File; reason: string }>;
    validFiles: File[];
}

export function validateFiles(files: File[]): FileValidationResult {
    const invalidFiles: Array<{ file: File; reason: string }> = [];
    const validFiles: File[] = [];
    
    for (const file of files) {
        if (!isValidFileType(file)) {
            invalidFiles.push({
                file,
                reason: 'Only JPG, PNG, and PDF files are allowed. Please upload a valid file.',
            });
        } else {
            validFiles.push(file);
        }
    }
    
    return {
        valid: invalidFiles.length === 0,
        invalidFiles,
        validFiles,
    };
}

/**
 * Counts pages in a file
 * - Images: 1 page each
 * - PDFs: Extract page count (requires async processing)
 */
export async function countFilePages(file: File): Promise<number> {
    const fileType = getFileType(file);
    
    if (fileType === 'image') {
        return 1;
    }
    
    if (fileType === 'pdf') {
        return await countPDFPages(file);
    }
    
    return 0;
}

/**
 * Counts pages in a PDF file
 */
async function countPDFPages(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                
                try {
                    // Use pdfjs-dist for accurate page counting
                    const pdfjsLib = await import('pdfjs-dist');
                    
                    // Set worker if available
                    try {
                        if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                            pdfjsLib.GlobalWorkerOptions.workerSrc =
                                `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
                        }
                    } catch (workerError) {
                        console.warn('Worker setup failed, using main thread:', workerError);
                    }
                    
                    // Load PDF. `isEvalSupported` was removed from
                    // DocumentInitParameters in pdfjs-dist v5; default
                    // already disables eval-based font code.
                    const pdf = await pdfjsLib.getDocument({
                        data: arrayBuffer,
                        useWorkerFetch: false,
                        verbosity: 0,
                    }).promise;
                    
                    resolve(pdf.numPages);
                } catch (pdfError) {
                    console.warn('PDF.js error, falling back to regex method:', pdfError);
                    // Fallback: regex approach
                    try {
                        const typedArray = new Uint8Array(arrayBuffer);
                        const text = new TextDecoder('utf-8', { fatal: false }).decode(
                            typedArray.slice(0, 100000)
                        );
                        
                        // Try to find page count in PDF structure
                        const countMatch = text.match(/\/Count\s+(\d+)/);
                        if (countMatch && countMatch[1]) {
                            resolve(parseInt(countMatch[1], 10));
                            return;
                        }
                        
                        // Alternative: count page objects
                        const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
                        if (pageMatches && pageMatches.length > 0) {
                            resolve(pageMatches.length);
                            return;
                        }
                        
                        // Default to 1 page if cannot determine
                        console.warn(`Could not determine page count for ${file.name}, defaulting to 1`);
                        resolve(1);
                    } catch (regexError) {
                        console.warn(`All PDF counting methods failed for ${file.name}, defaulting to 1 page`);
                        resolve(1);
                    }
                }
            } catch (err) {
                reject(err instanceof Error ? err : new Error('Failed to read PDF file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Calculates total page count for multiple files
 */
export async function calculateTotalPages(files: File[]): Promise<number> {
    const pageCounts = await Promise.all(files.map((file) => countFilePages(file)));
    return pageCounts.reduce((total, count) => total + count, 0);
}
