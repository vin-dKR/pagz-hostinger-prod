"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, File, AlertTriangle, X, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { uploadOrderFilesToS3, deleteOrderFile } from "@/lib/api/uploads";
import { toastError, toastSuccess } from "@/lib/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { redirectToLoginWithReturn } from "@/lib/utils/auth-redirect";

export interface FileDetail {
    file: File;
    type: 'image' | 'pdf';
    pageCount: number;
    id: string;
    s3Key?: string; // S3 key if file has been uploaded
    uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'error'; // Upload status
    uploadAbortController?: AbortController; // For canceling uploads
}

interface ProductDocumentUploadProps {
    onFileSelect: (files: File[], pageCount: number, fileDetails?: FileDetail[]) => void;
    onQuantityChange?: (quantity: number) => void;
    acceptedTypes?: string;
    maxSizeMB?: number;
    maxFiles?: number;
    className?: string;
    uploadedFilesS3?: FileDetail[]
    setUploadedFilesS3: React.Dispatch<React.SetStateAction<FileDetail[]>>
}

export default function ProductDocumentUpload({
    onFileSelect,
    onQuantityChange,
    acceptedTypes = "image/*,.pdf",
    maxSizeMB = 50,
    maxFiles,
    className = "",
    uploadedFilesS3,
    setUploadedFilesS3
}: ProductDocumentUploadProps) {
    const { isAuthenticated } = useAuth();
    const [totalQuantity, setTotalQuantity] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removingFileId, setRemovingFileId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const pendingCallbackRef = useRef<{ files: File[]; quantity: number; details: FileDetail[] } | null>(null);
    console.log("---uploadedFilesS3", uploadedFilesS3)

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

    // Valid image types
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const validPDFType = 'application/pdf';

    const isValidFileType = (file: File): boolean => {
        const isValidImage = validImageTypes.includes(file.type);
        const isValidPDF = file.type === validPDFType || file.name.toLowerCase().endsWith('.pdf');
        return isValidImage || isValidPDF;
    };

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

                        // Load PDF - will use main thread if worker fails
                        const pdf = await pdfjsLib.getDocument({
                            data: arrayBuffer,
                            useWorkerFetch: false,
                            isEvalSupported: false,
                            verbosity: 0,
                        }).promise;

                        const pageCount = pdf.numPages;
                        console.log(`PDF ${file.name} has ${pageCount} pages`);
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
                                console.log(`PDF ${file.name} page count (regex): ${count}`);
                                resolve(count);
                                return;
                            }

                            // Alternative: count page objects
                            const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
                            if (pageMatches && pageMatches.length > 0) {
                                const count = pageMatches.length;
                                console.log(`PDF ${file.name} page count (object count): ${count}`);
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

        for (const file of files) {
            // Validate file type
            if (!isValidFileType(file)) {
                throw new Error(`Invalid file type: ${file.name}. Only images (JPG, PNG, WebP, GIF) and PDFs are allowed.`);
            }

            // Validate file size
            const maxSize = file.type.startsWith('image/') ? 10 : 50; // Images: 10MB, PDFs: 50MB
            if (!validateFileSize(file, maxSize)) {
                throw new Error(`File ${file.name} exceeds ${maxSize}MB size limit.`);
            }

            // Determine file type
            const isImage = validImageTypes.includes(file.type);
            const isPDF = file.type === validPDFType || file.name.toLowerCase().endsWith('.pdf');

            if (isImage) {
                // Image = 1 page
                fileDetails.push({
                    file,
                    type: 'image',
                    pageCount: 1,
                    id: `${Date.now()}-${Math.random()}`,
                    uploadStatus: 'pending',
                });
                totalQuantity += 1;
            } else if (isPDF) {
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

        // Check authentication first
        if (!isAuthenticated) {
            redirectToLoginWithReturn();
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        // Check max files limit
        if (maxFiles && files.length > maxFiles) {
            setError(`Maximum ${maxFiles} files allowed`);
            return;
        }

        setError(null);
        setIsProcessing(true);

        try {
            // Process files locally (NO S3 upload yet - files stored in memory only)
            const { fileDetails: newFileDetails } = await processFiles(files);

            // Combine with existing files
            const allFileDetails = [...(uploadedFilesS3 || []), ...newFileDetails];
            const allFiles = allFileDetails.map(fd => fd.file);
            const finalPageCount = allFileDetails.reduce((sum, fd) => sum + fd.pageCount, 0);

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

            // Upload files to S3 immediately
            // Upload each file individually so we can track and cancel them
            newFileDetails.forEach((fileDetail) => {
                uploadFileToS3(fileDetail);
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to process files';
            setError(errorMessage);
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Upload a single file to S3
    const uploadFileToS3 = async (fileDetail: FileDetail) => {
        // Create abort controller for this upload
        const abortController = new AbortController();
        uploadAbortControllersRef.current.set(fileDetail.id, abortController);

        // Update status to uploading
        setUploadedFilesS3((prev) => {
            const updated = prev.map((fd) =>
                fd.id === fileDetail.id
                    ? { ...fd, uploadStatus: 'uploading' as const, uploadAbortController: abortController }
                    : fd
            );
            // Schedule callback after state update
            const files = updated.map((fd) => fd.file);
            const totalQuantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
            pendingCallbackRef.current = { files, quantity: totalQuantity, details: updated };
            return updated;
        });

        try {
            const response = await uploadOrderFilesToS3([fileDetail.file]);

            // Check if upload was aborted
            if (abortController.signal.aborted) {
                return; // Upload was cancelled, exit silently
            }

            if (response.success && response.data && response.data.files.length > 0) {
                const uploadedFile = response.data.files[0];
                if (uploadedFile?.key) {
                    // Update status to uploaded and store S3 key
                    setUploadedFilesS3((prev) => {
                        const updated = prev.map((fd) =>
                            fd.id === fileDetail.id
                                ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: uploadedFile.key }
                                : fd
                        );
                        // Schedule callback after state update
                        const files = updated.map((fd) => fd.file);
                        const totalQuantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
                        pendingCallbackRef.current = { files, quantity: totalQuantity, details: updated };
                        return updated;
                    });
                } else {
                    throw new Error('Upload failed - no key returned');
                }
            } else {
                throw new Error('Upload failed');
            }
        } catch (err) {
            // Check if upload was aborted
            if (abortController.signal.aborted) {
                // Upload was cancelled, remove the file
                setUploadedFilesS3((prev) => {
                    const updated = prev.filter((fd) => fd.id !== fileDetail.id);
                    const updatedQuantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
                    setTotalQuantity(updatedQuantity);
                    const files = updated.map((fd) => fd.file);
                    // Schedule callback after state update
                    pendingCallbackRef.current = { files, quantity: updatedQuantity, details: updated };
                    return updated;
                });
                return;
            }

            // Upload failed
            setUploadedFilesS3((prev) => {
                const updated = prev.map((fd) =>
                    fd.id === fileDetail.id ? { ...fd, uploadStatus: 'error' as const } : fd
                );
                // Schedule callback after state update
                const files = updated.map((fd) => fd.file);
                const totalQuantity = updated.reduce((sum, fd) => sum + fd.pageCount, 0);
                pendingCallbackRef.current = { files, quantity: totalQuantity, details: updated };
                return updated;
            });
            toastError(`Failed to upload ${fileDetail.file.name}`);
        } finally {
            // Clean up abort controller
            uploadAbortControllersRef.current.delete(fileDetail.id);
        }
    };

    const handleRemove = async (fileId: string) => {
        console.log("---file to be deleted", fileId)
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

    // const imageCount = uploadedFilesS3.filter(f => f.type === 'image').length;
    // const pdfCount = uploadedFilesS3.filter(f => f.type === 'pdf').length;
    // const pdfPageCount = uploadedFilesS3
    //     .filter(f => f.type === 'pdf')
    //     .reduce((sum, f) => sum + f.pageCount, 0);

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
                        multiple
                        className="hidden"
                        disabled={isProcessing}
                    />
                    <label
                        htmlFor="document-upload"
                        className={`inline-flex items-center gap-2 px-6 py-3 bg-[#CFCFCF] hover:bg-gray-400 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors ${isProcessing || uploadedFilesS3?.some(f => f.uploadStatus === 'uploading') ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {(isProcessing || uploadedFilesS3?.some(f => f.uploadStatus === 'uploading')) ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {uploadedFilesS3?.some(f => f.uploadStatus === 'uploading') ? 'Uploading...' : 'Processing...'}
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Upload Documents
                            </>
                        )}
                    </label>
                    <p className="mt-2 text-xs text-gray-500">
                        Supported formats: Images (JPG, PNG, WebP, GIF - Max 10MB) and PDFs (Max 50MB)
                        {maxFiles && ` • Max ${maxFiles} files`}
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* File List */}
                {uploadedFilesS3 && uploadedFilesS3.length > 0 && (
                    <div className="space-y-3">
                        <div className="space-y-2">
                            {uploadedFilesS3?.map((fileDetail) => (
                                <div
                                    key={fileDetail.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
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
                                            <p className="text-xs text-gray-500">
                                                {(fileDetail.file.size / 1024 / 1024).toFixed(2)} MB •{' '}
                                                {fileDetail.type === 'pdf'
                                                    ? `${fileDetail.pageCount} page${fileDetail.pageCount !== 1 ? 's' : ''}`
                                                    : '1 page'}
                                                {fileDetail.uploadStatus === 'uploading' && (
                                                    <span className="ml-2 text-blue-600 flex items-center gap-1">
                                                        <Loader2 size={12} className="animate-spin" />
                                                        Uploading...
                                                    </span>
                                                )}
                                                {fileDetail.uploadStatus === 'uploaded' && (
                                                    <span className="ml-2 text-green-600">✓ Uploaded</span>
                                                )}
                                                {fileDetail.uploadStatus === 'error' && (
                                                    <span className="ml-2 text-red-600">✗ Upload failed</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {removingFileId === fileDetail.id ? (
                                        <div className="p-1 shrink-0">
                                            <Loader2 size={18} className="animate-spin text-blue-600" />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleRemove(fileDetail.id)}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                                            type="button"
                                            disabled={removingFileId !== null}
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
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
