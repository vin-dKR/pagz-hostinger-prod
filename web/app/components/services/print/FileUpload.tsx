'use client';

import React, { useCallback } from 'react';
import { Upload, File, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    uploadedFile: File | null;
    onRemove: () => void;
    accept?: string;
    maxSizeMB?: number;
    title?: string;
    description?: string;
    className?: string;
}

export const ProductFileUpload: React.FC<FileUploadProps> = ({
    onFileSelect,
    uploadedFile,
    onRemove,
    accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    maxSizeMB = 100,
    title = 'Upload Your File',
    description = 'Click or drag and drop to upload',
    className,
}) => {
    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.size <= maxSizeMB * 1024 * 1024) {
                onFileSelect(file);
            }
        },
        [onFileSelect, maxSizeMB]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file && file.size <= maxSizeMB * 1024 * 1024) {
                onFileSelect(file);
            }
        },
        [onFileSelect, maxSizeMB]
    );

    const getFileIcon = (fileName: string) => {
        const extension = fileName.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
            return <ImageIcon className="w-8 h-8 text-[#008ECC]" />;
        }
        return <File className="w-8 h-8 text-[#008ECC]" />;
    };

    return (
        <div className={cn('space-y-4', className)}>
            <label className="block text-sm font-medium text-gray-700 mb-3 font-hkgb">
                {title}
            </label>

            {uploadedFile ? (
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {getFileIcon(uploadedFile.name)}
                            <div>
                                <div className="font-medium text-gray-900 text-sm truncate max-w-[200px] sm:max-w-[300px]">
                                    {uploadedFile.name}
                                </div>
                                <div className="text-gray-600 text-xs">
                                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onRemove}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={cn(
                        'border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200',
                        'hover:border-[#008ECC] hover:bg-blue-50/50'
                    )}
                    onClick={() => document.getElementById('file-upload')?.click()}
                >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <div className="font-medium text-gray-900 text-sm sm:text-base mb-2">
                        {description}
                    </div>
                    <div className="text-gray-600 text-xs sm:text-sm mb-4">
                        Supported: {accept.replace(/\./g, '').replace(/,/g, ', ')}
                    </div>
                    <div className="text-xs text-gray-500">
                        Max file size: {maxSizeMB}MB
                    </div>
                    <input
                        id="file-upload"
                        type="file"
                        accept={accept}
                        onChange={handleChange}
                        className="hidden"
                    />
                </div>
            )}
        </div>
    );
};
