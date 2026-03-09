"use client";

import { useState, useCallback } from "react";
import { uploadFileToFTP, uploadMultipleFilesToFTP, testFTPConnection, type FTPUploadResult } from "@/lib/api/ftp";
import toast from "react-hot-toast";

export default function FTPUploadPage() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFiles, setUploadedFiles] = useState<FTPUploadResult[]>([]);
    const [subDir, setSubDir] = useState("test-uploads");
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const testConnection = async () => {
        setConnectionStatus("testing");
        try {
            const response = await testFTPConnection();
            if (response.success && response.data?.connected) {
                setConnectionStatus("connected");
                toast.success("FTP connection successful!");
            } else {
                setConnectionStatus("failed");
                toast.error("FTP connection failed");
            }
        } catch (error: any) {
            setConnectionStatus("failed");
            toast.error(error.message || "Failed to test FTP connection");
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Please select at least one file to upload");
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadedFiles([]);

        try {
            let results: FTPUploadResult[] = [];

            if (selectedFiles.length === 1) {
                // Single file upload
                const file = selectedFiles[0];
                if (file) {
                    const response = await uploadFileToFTP(file, subDir);
                    if (response.success && response.data) {
                        results = [response.data];
                        toast.success("File uploaded successfully!");
                    }
                }
            } else {
                // Multiple files upload
                const response = await uploadMultipleFilesToFTP(selectedFiles, subDir);
                if (response.success && response.data) {
                    results = response.data.files;
                    toast.success(`${response.data.count} file(s) uploaded successfully!`);
                }
            }

            setUploadedFiles(results);
            setSelectedFiles([]);
            setUploadProgress(100);
        } catch (error: any) {
            toast.error(error.message || "Failed to upload files");
            console.error("Upload error:", error);
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 2000);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                        FTP File Upload
                    </h1>
                    <p className="text-gray-600">
                        Upload files to Hostinger FTP server
                    </p>
                </div>

                {/* Connection Test */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">
                                FTP Connection Status
                            </h2>
                            <p className="text-sm text-gray-600">
                                Test your connection to the FTP server
                            </p>
                        </div>
                        <button
                            onClick={testConnection}
                            disabled={connectionStatus === "testing"}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                connectionStatus === "connected"
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : connectionStatus === "failed"
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {connectionStatus === "testing"
                                ? "Testing..."
                                : connectionStatus === "connected"
                                ? "✓ Connected"
                                : connectionStatus === "failed"
                                ? "✗ Failed"
                                : "Test Connection"}
                        </button>
                    </div>
                </div>

                {/* Upload Directory */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Directory (subdirectory in public_html)
                    </label>
                    <input
                        type="text"
                        value={subDir}
                        onChange={(e) => setSubDir(e.target.value)}
                        placeholder="test-uploads"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                        Files will be uploaded to: <code className="bg-gray-100 px-2 py-1 rounded">public_html/{subDir || "test-uploads"}</code>
                    </p>
                </div>

                {/* File Upload Area */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Select Files
                    </h2>

                    {/* Drag and Drop Area */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    >
                        <input
                            type="file"
                            id="file-upload"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <svg
                                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 48 48"
                            >
                                <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <p className="text-gray-600 mb-2">
                                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-sm text-gray-500">
                                Multiple files supported (Max 100MB per file)
                            </p>
                        </label>
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">
                                Selected Files ({selectedFiles.length})
                            </h3>
                            <div className="space-y-2">
                                {selectedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(file.size)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="ml-4 text-red-600 hover:text-red-700"
                                        >
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Button */}
                    {selectedFiles.length > 0 && (
                        <div className="mt-6">
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? "Uploading..." : `Upload ${selectedFiles.length} File(s)`}
                            </button>
                            
                            {uploading && (
                                <div className="mt-4">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Uploaded Files Results */}
                {uploadedFiles.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Uploaded Files ({uploadedFiles.length})
                        </h2>
                        <div className="space-y-4">
                            {uploadedFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className="p-4 bg-green-50 border border-green-200 rounded-lg"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                {file.originalName}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Remote: {file.remoteFileName}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Size: {formatFileSize(file.size)} • {file.mimetype}
                                            </p>
                                        </div>
                                        <a
                                            href={file.publicUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                        >
                                            View
                                        </a>
                                    </div>
                                    <div className="mt-3 p-2 bg-white rounded text-xs font-mono text-gray-600 break-all">
                                        {file.publicUrl}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
