'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Image as ImageIcon, X } from 'lucide-react';
import { useCategoryTemplates } from '@/lib/hooks/use-category-templates';
import { FileDetail } from '@/app/components/products/ProductDocumentUpload';
import { getPublicS3Url } from '@/lib/utils/s3';

interface TemplateSelectorProps {
    categorySlug: string;
    onTemplateSelect: (templateId: string | null, formData: Record<string, any>, formImages: string[], templateName?: string, templatePreviewImage?: string) => void;
    selectedTemplateId?: string | null;
    selectedFormData?: Record<string, any>;
    selectedFormImages?: string[];
    uploadedFiles?: FileDetail[];
    onFileSelect?: (files: File[]) => void;
}

export function TemplateSelector({
    categorySlug,
    onTemplateSelect,
    selectedTemplateId,
    selectedFormData,
    selectedFormImages,
    uploadedFiles,
    onFileSelect,
}: TemplateSelectorProps) {
    const router = useRouter();
    const { data: templates = [], isLoading: loadingTemplates } = useCategoryTemplates(categorySlug, true);

    // Check for template data from sessionStorage when component mounts
    useEffect(() => {
        const storedData = sessionStorage.getItem('selectedTemplateData');
        if (storedData) {
            try {
                const templateData = JSON.parse(storedData);
                onTemplateSelect(
                    templateData.templateId,
                    templateData.formData || {},
                    templateData.formImages || [],
                    templateData.templateName,
                    templateData.templatePreviewImage
                );
                // Clear the stored data after using it
                sessionStorage.removeItem('selectedTemplateData');
            } catch (error) {
                console.error('Error parsing template data:', error);
            }
        }
    }, [onTemplateSelect]);

    const handleClick = () => {
        if (templates.length === 0) {
            // No templates, trigger file input click
            const fileInput = document.getElementById('template-upload-select') as HTMLInputElement;
            if (fileInput) {
                fileInput.click();
            }
        } else {
            // Templates exist, go to template page
            router.push(`/services/${categorySlug}/templates`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0 && onFileSelect) {
            // Convert FileList to File array and pass to parent
            const fileArray = Array.from(files);
            onFileSelect(fileArray);
        }
    };

    // Show button only if templates are loaded (to avoid flickering)
    if (loadingTemplates) {
        return null;
    }

    return (
        <div className="w-full">
            {templates.length > 0 && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Your Design or Choose Template
                </label>
            )}
            <div className="flex flex-col gap-2">
                <input
                    type="file"
                    id="template-upload-select"
                    className="hidden"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileChange}
                />
                <div>
                    <label
                        htmlFor={templates.length === 0 ? "template-upload-select" : undefined}
                        onClick={templates.length > 0 ? handleClick : undefined}
                        className={`inline-flex items-center gap-2 px-6 py-3 bg-[#CFCFCF] hover:bg-gray-400 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors ${
                            templates.length === 0 ? 'cursor-pointer' : ''
                        }`}
                    >
                        {templates.length === 0 ? (
                            <>
                                <Upload size={18} />
                                Upload Documents
                            </>
                        ) : (
                            <>
                                <FileText size={18} />
                                {selectedTemplateId ? 'Change Template' : 'Upload Design or Choose Template'}
                            </>
                        )}
                    </label>
                    <p className="mt-2 text-xs text-gray-500">
                        {templates.length === 0 
                            ? 'Supported formats: Images (JPG, PNG, WebP, GIF - Max 10MB) and PDFs (Max 50MB)'
                            : 'Upload your own design or select from available templates'
                        }
                    </p>
                </div>
                {selectedTemplateId && (
                    <p className="text-sm text-gray-600">
                        Template selected. Click to change.
                    </p>
                )}

                {/* Display Uploaded Files */}
                {uploadedFiles && uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                            {uploadedFiles.map((fileDetail) => (
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
                                                {fileDetail.uploadStatus === 'uploaded' && (
                                                    <span className="ml-2 text-green-600">✓ Uploaded</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Display Template Form Data */}
                {selectedTemplateId && selectedFormData && Object.keys(selectedFormData).length > 0 && (
                    <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                            {Object.entries(selectedFormData).map(([key, value]) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileText size={20} className="text-purple-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                {key}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {String(value)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Display Template Form Images */}
                {selectedTemplateId && selectedFormImages && selectedFormImages.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                            {selectedFormImages.map((imgUrl, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <ImageIcon size={20} className="text-purple-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                Form Image {idx + 1}
                                            </p>
                                            <a
                                                href={getPublicS3Url(imgUrl)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                View Image
                                            </a>
                                        </div>
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
