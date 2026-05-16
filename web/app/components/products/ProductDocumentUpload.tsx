"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, AlertTriangle, X, Image as ImageIcon, FileText, Loader2, Info, RotateCw, Ban } from "lucide-react";
import { uploadOneFile, deleteOrderFile } from "@/lib/api/uploads";
import { isAbortError } from "@/lib/api/ftp";
import { toastError, toastSuccess } from "@/lib/utils/toast";
import { validateFiles, getFileType } from "@/lib/utils/file-validation";

export interface FileDetail {
    file: File;
    type: 'image' | 'pdf';
    pageCount: number;
    id: string;
    /** Relative FTP path stored in DB (e.g. "orders/12345-design.pdf"). Previously called s3Key. */
    s3Key?: string;
    /**
     * Lifecycle states:
     *  - `'pending'`  — selected but not yet picked up by the serial loop
     *                   (the loop also uses this for queued rows so existing
     *                   consumer code that checks `=== 'pending'` keeps working)
     *  - `'uploading'`— XHR in flight
     *  - `'uploaded'` — done, `s3Key` set
     *  - `'error'`    — failed OR cancelled (check `uploadError === 'cancelled'`
     *                   for the latter). Reusing `'error'` keeps the existing
     *                   downstream `filter(f => f.uploadStatus === 'error')`
     *                   guard in service pages catching cancellations too.
     */
    uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'error';
    /** 0–100; only meaningful while `uploadStatus === 'uploading'`. */
    uploadProgress?: number;
    /** Last failure / cancel message for the row. `'cancelled'` is special. */
    uploadError?: string;
    uploadAbortController?: AbortController;
}

interface ProductDocumentUploadProps {
    onFileSelect: (files: File[], pageCount: number, fileDetails?: FileDetail[]) => void;
    onQuantityChange?: (quantity: number) => void;
    /** Browser-level filter. Restricted to JPG/PNG/PDF MIME + extensions
     *  so the OS picker hides mp3/mp4/etc. by default. The user can still
     *  override via "All files" — `validateFiles` enforces the same rule
     *  server-side-style on the client before upload. */
    acceptedTypes?: string;
    maxSizeMB?: number;
    maxFiles?: number;
    className?: string;
    uploadedFilesS3?: FileDetail[]
    setUploadedFilesS3: React.Dispatch<React.SetStateAction<FileDetail[]>>
    maxPages?: number | null;
    currentPageCount?: number;
    pageControllerError?: string | null;
    hasPageControllerRules?: boolean;
}

export default function ProductDocumentUpload({
    onFileSelect,
    onQuantityChange,
    acceptedTypes = "image/jpeg,image/jpg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf",
    maxSizeMB = 50,
    maxFiles,
    className = "",
    uploadedFilesS3,
    setUploadedFilesS3,
    maxPages = null,
    currentPageCount = 0,
    pageControllerError = null,
    hasPageControllerRules = false,
}: ProductDocumentUploadProps) {
    const IMAGE_MAX_SIZE_MB = 25;
    const PDF_MAX_SIZE_MB = 75;
    const [totalQuantity, setTotalQuantity] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removingFileId, setRemovingFileId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const batchAbortControllerRef = useRef<AbortController | null>(null);
    const pendingCallbackRef = useRef<{ files: File[]; quantity: number; details: FileDetail[] } | null>(null);

    // Sync state changes to parent component using useEffect (only for upload status changes)
    useEffect(() => {
        // Only call callback if there's a pending update from upload status changes
        if (pendingCallbackRef.current) {
            const { files, quantity, details } = pendingCallbackRef.current;
            pendingCallbackRef.current = null;
            // Pass pageCount (quantity) instead of totalQuantity
            onFileSelect(files, quantity, details);
            if (onQuantityChange) {
                onQuantityChange(quantity);
            }
        }
    }, [uploadedFilesS3]);

    // File type validation is now handled by utility functions
    // Keep these for backward compatibility with existing code
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validPDFType = 'application/pdf';

    const validateFileSize = (file: File, maxSizeMB: number): boolean => {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    };

    const countPDFPages = async (file: File): Promise<number> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;

                    try {
                        // Use pdfjs-dist for accurate page counting
                        const pdfjsLib = await import('pdfjs-dist');

                        // Try to set worker, but if it fails, PDF.js will use main thread
                        // Use jsdelivr CDN which is more reliable
                        try {
                            if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                                pdfjsLib.GlobalWorkerOptions.workerSrc =
                                    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
                            }
                        } catch (workerError) {
                            // If worker setup fails, PDF.js will use main thread automatically
                            console.warn('Worker setup failed, using main thread:', workerError);
                        }

                        // Load PDF — will use main thread if worker fails.
                        // `isEvalSupported` was removed from
                        // DocumentInitParameters in pdfjs-dist v5; the
                        // default already disables eval-based font code,
                        // so dropping the flag matches v5 behaviour.
                        const pdf = await pdfjsLib.getDocument({
                            data: arrayBuffer,
                            useWorkerFetch: false,
                            verbosity: 0,
                        }).promise;

                        const pageCount = pdf.numPages;
                        resolve(pageCount);
                    } catch (pdfError) {
                        console.warn('PDF.js worker error, falling back to regex method:', pdfError);
                        // Fallback: try regex approach (more reliable, no worker needed)
                        try {
                            const typedArray = new Uint8Array(arrayBuffer);
                            const text = new TextDecoder('utf-8', { fatal: false }).decode(typedArray.slice(0, 100000));

                            // Try to find page count in PDF structure
                            const countMatch = text.match(/\/Count\s+(\d+)/);
                            if (countMatch && countMatch[1]) {
                                const count = parseInt(countMatch[1], 10);
                                resolve(count);
                                return;
                            }

                            // Alternative: count page objects
                            const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
                            if (pageMatches && pageMatches.length > 0) {
                                const count = pageMatches.length;
                                resolve(count);
                                return;
                            }

                            // If all methods fail, default to 1 page (better UX than error)
                            console.warn(`Could not determine page count for ${file.name}, defaulting to 1`);
                            resolve(1);
                        } catch (regexError) {
                            // Final fallback: assume 1 page
                            console.warn(`All PDF counting methods failed for ${file.name}, defaulting to 1 page`);
                            resolve(1);
                        }
                    }
                } catch (err) {
                    console.error('Error counting PDF pages:', err);
                    reject(err instanceof Error ? err : new Error('Failed to read PDF file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const processFiles = async (files: File[]): Promise<{
        totalQuantity: number;
        fileDetails: FileDetail[];
    }> => {
        const fileDetails: FileDetail[] = [];
        let totalQuantity = 0;

        // Validate file types first (only JPG, PNG, PDF allowed)
        const validationResult = validateFiles(files);
        if (!validationResult.valid) {
            const invalidFileNames = validationResult.invalidFiles.map(f => f.file.name).join(', ');
            throw new Error(`Invalid file type(s): ${invalidFileNames}. Only JPG, PNG, and PDF files are allowed.`);
        }

        // Process only valid files
        const validFiles = validationResult.validFiles;

        for (const file of validFiles) {
            // File type already validated, get type
            const fileType = getFileType(file);
            if (fileType === 'invalid') {
                throw new Error(`Invalid file type: ${file.name}. Only JPG, PNG, and PDF files are allowed.`);
            }

            // Validate file size
            const maxSize = fileType === 'image' ? IMAGE_MAX_SIZE_MB : PDF_MAX_SIZE_MB;
            if (!validateFileSize(file, maxSize)) {
                throw new Error(`File ${file.name} exceeds ${maxSize}MB size limit.`);
            }

            if (fileType === 'image') {
                // Image = 1 page
                fileDetails.push({
                    file,
                    type: 'image',
                    pageCount: 1,
                    id: `${Date.now()}-${Math.random()}`,
                    uploadStatus: 'pending',
                });
                totalQuantity += 1;
            } else if (fileType === 'pdf') {
                // Extract PDF page count
                try {
                    const pageCount = await countPDFPages(file);
                    fileDetails.push({
                        file,
                        type: 'pdf',
                        pageCount,
                        id: `${Date.now()}-${Math.random()}`,
                        uploadStatus: 'pending',
                    });
                    totalQuantity += pageCount;
                } catch (err) {
                    throw new Error(`Failed to process PDF ${file.name}. Please try again.`);
                }
            }
        }

        return { totalQuantity, fileDetails };
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
            return;
        }

        // REMOVED: Authentication check - allow file upload without authentication
        // Files will be stored temporarily and uploaded to S3 after sign-in

        // Check max files limit
        if (maxFiles && files.length > maxFiles) {
            setError(`Maximum ${maxFiles} files allowed`);
            return;
        }

        setError(null);
        setIsProcessing(true);

        try {
            // Process files locally (calculate page count, etc.)
            const { fileDetails: newFileDetails } = await processFiles(files);

            // Combine with existing files
            const allFileDetails = [...(uploadedFilesS3 || []), ...newFileDetails];
            const allFiles = allFileDetails.map(fd => fd.file);
            const finalPageCount = allFileDetails.reduce((sum, fd) => sum + fd.pageCount, 0);

            // Hard guard: never upload files if page-controller max page limit is exceeded.
            if (hasPageControllerRules && maxPages !== null && finalPageCount > maxPages) {
                setError(
                    `Uploaded pages (${finalPageCount}) exceed allowed limit (${maxPages}) for the current selection.`
                );
                return;
            }

            // Update state first
            setUploadedFilesS3(allFileDetails);
            setTotalQuantity(finalPageCount);

            // Call callback immediately for initial file selection
            // Pass pageCount (calculated from files) instead of totalQuantity
            // useEffect will handle subsequent updates
            onFileSelect(allFiles, finalPageCount, allFileDetails);
            if (onQuantityChange) {
                onQuantityChange(finalPageCount);
            }

            // Upload newly-selected files one-by-one with per-file progress,
            // status, and cancel/retry support. Issue #58.
            uploadFilesSerially(newFileDetails);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to process files';
            setError(errorMessage);
            toastError(errorMessage);
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    /**
     * Helper — patch one file in `uploadedFilesS3` by id and schedule the
     * parent callback off the updated state. Keeps all in-place updates
     * consistent so the parent always sees the same shape.
     */
    const patchFile = (id: string, patch: Partial<FileDetail>) => {
        setUploadedFilesS3((prev) => {
            const updated = prev.map((fd) => (fd.id === id ? { ...fd, ...patch } : fd));
            const files = updated.map((fd) => fd.file);
            const quantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
            pendingCallbackRef.current = { files, quantity, details: updated };
            return updated;
        });
    };

    /**
     * Upload a single file with progress + cancel. Used both for the initial
     * serial loop and for per-row "Retry" clicks.
     *
     * Returns `true` on success, `false` on error/cancel — callers decide
     * whether to continue the surrounding loop (we always do; see issue #58:
     * "On error per file: mark error, continue with rest").
     */
    const uploadSingleFileWithProgress = async (fd: FileDetail): Promise<boolean> => {
        const controller = new AbortController();
        uploadAbortControllersRef.current.set(fd.id, controller);

        patchFile(fd.id, {
            uploadStatus: 'uploading',
            uploadProgress: 0,
            uploadError: undefined,
            uploadAbortController: controller,
        });

        try {
            const result = await uploadOneFile(
                fd.file,
                (e) => patchFile(fd.id, { uploadProgress: e.percent }),
                { signal: controller.signal },
            );
            patchFile(fd.id, {
                uploadStatus: 'uploaded',
                uploadProgress: 100,
                s3Key: result.key,
                uploadAbortController: undefined,
            });
            return true;
        } catch (err) {
            if (isAbortError(err) || controller.signal.aborted) {
                // Re-use the `error` slot for cancellation so existing
                // downstream guards (`filter(f => f.uploadStatus === 'error')`)
                // pick it up. UI distinguishes via `uploadError === 'cancelled'`.
                patchFile(fd.id, {
                    uploadStatus: 'error',
                    uploadError: 'cancelled',
                    uploadAbortController: undefined,
                });
                return false;
            }
            const message = err instanceof Error ? err.message : 'Upload failed';
            patchFile(fd.id, {
                uploadStatus: 'error',
                uploadError: message,
                uploadAbortController: undefined,
            });
            toastError(`Failed to upload ${fd.file.name}: ${message}`);
            return false;
        } finally {
            uploadAbortControllersRef.current.delete(fd.id);
        }
    };

    /**
     * Serial multi-file upload (issue #58).
     *
     * - Queues every file up-front so the UI shows pending rows.
     * - Uploads one at a time so a single bad file doesn't kill the rest.
     * - If the batch is cancelled mid-way, remaining queued files are
     *   marked `cancelled` and the loop exits early.
     */
    const uploadFilesSerially = async (fileDetails: FileDetail[]) => {
        if (fileDetails.length === 0) return;

        // Mark every selected file as `pending` (= queued) so all rows
        // render with a pending state up-front (user sees the full list
        // immediately, before the first request fires).
        setUploadedFilesS3((prev) => {
            const ids = new Set(fileDetails.map((f) => f.id));
            const updated = prev.map((fd) =>
                ids.has(fd.id)
                    ? { ...fd, uploadStatus: 'pending' as const, uploadProgress: 0 }
                    : fd
            );
            const files = updated.map((fd) => fd.file);
            const quantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
            pendingCallbackRef.current = { files, quantity, details: updated };
            return updated;
        });

        // Set up a batch-level abort controller so "Cancel" can stop the
        // remaining queue. Per-file controllers handle the in-flight request.
        const batchController = new AbortController();
        batchAbortControllerRef.current = batchController;

        try {
            for (const fd of fileDetails) {
                if (batchController.signal.aborted) {
                    // Mark remaining queued files as cancelled (stored in
                    // the `error` slot so existing checkout guards block on it).
                    patchFile(fd.id, {
                        uploadStatus: 'error',
                        uploadError: 'cancelled',
                    });
                    continue;
                }
                await uploadSingleFileWithProgress(fd);
            }
        } finally {
            if (batchAbortControllerRef.current === batchController) {
                batchAbortControllerRef.current = null;
            }
        }
    };

    /** Retry a single failed/cancelled row. Issue #58 — per-file retry. */
    const handleRetry = (fileId: string) => {
        const fd = uploadedFilesS3?.find((f) => f.id === fileId);
        if (!fd) return;
        if (fd.uploadStatus === 'uploading') return;
        uploadSingleFileWithProgress(fd);
    };

    /** Cancel the in-flight serial batch and any remaining queued files. */
    const handleCancelAll = () => {
        batchAbortControllerRef.current?.abort();
        // Abort whichever per-file request is in flight; the loop's catch
        // path will mark it `cancelled`. Remaining queued files are flipped
        // by the loop body's batch-abort check.
        uploadAbortControllersRef.current.forEach((ctrl) => {
            try { ctrl.abort(); } catch { /* no-op */ }
        });
    };

    const handleRemove = async (fileId: string) => {
        const fileToRemove = uploadedFilesS3?.find((fd) => fd.id === fileId);
        if (!fileToRemove) return;

        // Set removing state to show loader
        setRemovingFileId(fileId);

        // If file is currently uploading, cancel the upload
        if (fileToRemove.uploadStatus === 'uploading' && fileToRemove.uploadAbortController) {
            fileToRemove.uploadAbortController.abort();
            uploadAbortControllersRef.current.delete(fileId);
        }

        // If file is already uploaded to S3, delete it
        if (fileToRemove.uploadStatus === 'uploaded' && fileToRemove.s3Key) {
            try {
                await deleteOrderFile(fileToRemove.s3Key);
                toastSuccess('File removed from storage');
            } catch (err) {
                console.error('Failed to delete file from S3:', err);
                // Continue with removal even if S3 delete fails
            }
        }

        // Remove file from state
        setUploadedFilesS3((prev) => {
            const updated = prev.filter((fd) => fd.id !== fileId);
            const updatedQuantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
            setTotalQuantity(updatedQuantity);

            // Schedule callback after state update
            const files = updated.map((fd) => fd.file);
            pendingCallbackRef.current = { files, quantity: updatedQuantity, details: updated };

            return updated;
        });

        // Clear removing state
        setRemovingFileId(null);
    };

    // ── Derived upload-progress stats (issue #58) ─────────────────────────────
    // `overallPercent` = (completed files + current file's percent) / total
    // across every file currently visible in the list. Already-uploaded
    // rows from prior batches count as 100% so the bar reflects the full
    // session, not just the most recent selection.
    const files = uploadedFilesS3 ?? [];
    const hasUploadsInFlight = files.some(
        (fd) => fd.uploadStatus === 'pending' || fd.uploadStatus === 'uploading'
    );
    const overallPercent = (() => {
        if (files.length === 0) return 0;
        const sum = files.reduce((acc, fd) => {
            if (fd.uploadStatus === 'uploaded') return acc + 100;
            if (fd.uploadStatus === 'uploading') return acc + (fd.uploadProgress ?? 0);
            // pending/error → 0 toward progress; the row still shows its own state.
            return acc;
        }, 0);
        return Math.min(100, Math.round(sum / files.length));
    })();

    return (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-900 mb-3">
                Upload Your Documents
            </label>

            <div className="space-y-4">
                {/* File Input */}
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        id="document-upload"
                        accept={acceptedTypes}
                        onChange={handleFileChange}
                        multiple={true}
                        className="hidden"
                        disabled={isProcessing}
                    />
                    <label
                        htmlFor="document-upload"
                        className={`inline-flex items-center gap-2 px-6 py-3 bg-[#CFCFCF] hover:bg-gray-400 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors ${isProcessing || hasUploadsInFlight ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {(isProcessing || hasUploadsInFlight) ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {hasUploadsInFlight ? `Uploading ${overallPercent}%…` : 'Processing...'}
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Upload Documents
                            </>
                        )}
                    </label>
                    <p className="mt-2 text-xs text-gray-500">
                        JPG / PNG ≤ {IMAGE_MAX_SIZE_MB} MB · PDF ≤ {PDF_MAX_SIZE_MB} MB
                        {maxFiles && ` • Max ${maxFiles} files`}
                    </p>
                    {hasPageControllerRules && maxPages !== null && (
                        <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                            <Info size={12} />
                            Maximum {maxPages} page{maxPages !== 1 ? 's' : ''} allowed for selected options
                        </p>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {pageControllerError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{pageControllerError}</p>
                    </div>
                )}

                {hasPageControllerRules && currentPageCount > 0 && maxPages !== null && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Info size={16} className="text-blue-600 shrink-0" />
                        <p className="text-sm text-blue-700">
                            Current: <span className="font-semibold">{currentPageCount}</span> • Max:{" "}
                            <span className="font-semibold">{maxPages}</span>
                        </p>
                    </div>
                )}

                {/* File List */}
                {uploadedFilesS3 && uploadedFilesS3.length > 0 && (
                    <div className="space-y-3">
                        {/* Overall progress + cancel-all (issue #58) */}
                        {hasUploadsInFlight && (
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <Loader2 size={16} className="text-blue-600 shrink-0 animate-spin" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
                                        <span>Uploading files…</span>
                                        <span className="font-semibold">{overallPercent}%</span>
                                    </div>
                                    <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                                            style={{ width: `${overallPercent}%` }}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelAll}
                                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 cursor-pointer"
                                >
                                    <Ban size={12} />
                                    Cancel
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {uploadedFilesS3?.map((fileDetail) => {
                                const status = fileDetail.uploadStatus;
                                const pct = fileDetail.uploadProgress ?? 0;
                                const isCancelled = status === 'error' && fileDetail.uploadError === 'cancelled';
                                const isFailed = status === 'error';
                                return (
                                    <div
                                        key={fileDetail.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 gap-3"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {fileDetail.type === 'image' ? (
                                                <ImageIcon size={20} className="text-blue-600 shrink-0" />
                                            ) : (
                                                <FileText size={20} className="text-red-600 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {fileDetail.file.name}
                                                </p>
                                                <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2">
                                                    <span>
                                                        {(fileDetail.file.size / 1024 / 1024).toFixed(2)} MB
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        {fileDetail.type === 'pdf'
                                                            ? `${fileDetail.pageCount} page${fileDetail.pageCount !== 1 ? 's' : ''}`
                                                            : '1 page'}
                                                    </span>
                                                    {status === 'pending' && (
                                                        <span className="text-gray-500">• Queued</span>
                                                    )}
                                                    {status === 'uploading' && (
                                                        <span className="text-blue-600 flex items-center gap-1">
                                                            <Loader2 size={12} className="animate-spin" />
                                                            {pct}%
                                                        </span>
                                                    )}
                                                    {status === 'uploaded' && (
                                                        <span className="text-green-600">✓ Uploaded</span>
                                                    )}
                                                    {isCancelled && (
                                                        <span className="text-red-600">✗ Cancelled</span>
                                                    )}
                                                    {isFailed && !isCancelled && (
                                                        <span className="text-red-600">
                                                            ✗ {fileDetail.uploadError || 'Upload failed'}
                                                        </span>
                                                    )}
                                                </p>

                                                {(status === 'pending' || status === 'uploading') && (
                                                    <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                                        <div
                                                            className="bg-blue-600 h-1 rounded-full transition-all duration-200"
                                                            style={{
                                                                width: status === 'uploading' ? `${pct}%` : '0%',
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {isFailed && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRetry(fileDetail.id)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                    title="Retry upload"
                                                    aria-label={`Retry uploading ${fileDetail.file.name}`}
                                                >
                                                    <RotateCw size={16} />
                                                </button>
                                            )}
                                            {removingFileId === fileDetail.id ? (
                                                <div className="p-1">
                                                    <Loader2 size={18} className="animate-spin text-blue-600" />
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleRemove(fileDetail.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                                    type="button"
                                                    disabled={removingFileId !== null}
                                                    aria-label={`Remove ${fileDetail.file.name}`}
                                                >
                                                    <X size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                )}

                {/* Processing Indicator */}
                {isProcessing && uploadedFilesS3?.length === 0 && (
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        Processing files...
                    </div>
                )}
            </div>
        </div>
    );
}
