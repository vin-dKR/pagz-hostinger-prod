'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type CategoryTemplate } from '@/lib/api/templates';
import { useCategoryTemplates } from '@/lib/hooks/use-category-templates';
import { getPublicS3Url } from '@/lib/utils/s3';
import { TemplateGallery } from '@/app/components/services/TemplateGallery';
import { TemplateForm } from '@/app/components/services/TemplateForm';
import { Dialog, DialogContent, DialogClose } from '@/app/components/ui/dialog';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import ProductDocumentUpload, { FileDetail } from '@/app/components/products/ProductDocumentUpload';

interface TemplatePageProps { 
    params: Promise<{ categorySlug: string }>;
}

export default function TemplatePage({ params }: TemplatePageProps) {
    const { categorySlug } = use(params);
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<CategoryTemplate | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [formImages, setFormImages] = useState<string[]>([]);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadedFilesS3, setUploadedFilesS3] = useState<FileDetail[]>([]);

    // Use TanStack Query for data fetching with caching
    const { 
        data: templates = [], 
        isLoading: loading, 
        error: queryError 
    } = useCategoryTemplates(categorySlug, true);

    const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load templates') : null;

    const handleTemplateClick = (template: CategoryTemplate) => {
        setSelectedTemplate(template);
        setFormData({});
        setFormImages([]);
        setDialogOpen(true);
    };

    const handleFormSubmit = (data: Record<string, any>, images: string[]) => {
        if (selectedTemplate) {
            // Store the selected template data in sessionStorage to pass back to the service page
            const templateData = {
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                templatePreviewImage: selectedTemplate.previewImageUrl,
                formData: data,
                formImages: images,
            };
            sessionStorage.setItem('selectedTemplateData', JSON.stringify(templateData));
            
            // Close dialog and navigate back to the service page
            setDialogOpen(false);
            router.push(`/services/${categorySlug}`);
        }
    };

    const handleBackToGallery = () => {
        setDialogOpen(false);
        setSelectedTemplate(null);
        setFormData({});
        setFormImages([]);
    };

    const handleChangeTemplate = () => {
        handleBackToGallery();
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedTemplate(null);
        setFormData({});
        setFormImages([]);
    };

    const handleBackToService = () => {
        router.push(`/services/${categorySlug}`);
    };

    const handleUploadClick = () => {
        setShowUploadDialog(true);
    };

    const handleFileSelect = (files: File[], pageCount: number, fileDetails?: FileDetail[]) => {
        if (fileDetails && fileDetails.length > 0) {
            // Check if all files have been uploaded (have s3Key)
            const allFilesUploaded = fileDetails.every(fd => fd.uploadStatus === 'uploaded' && fd.s3Key);
            
            if (allFilesUploaded) {
                // Store upload data in sessionStorage to pass back to service page
                const uploadData = {
                    uploadedFiles: fileDetails.map(fd => ({
                        name: fd.file.name,
                        s3Key: fd.s3Key,
                        type: fd.type,
                        pageCount: fd.pageCount,
                        id: fd.id,
                        size: fd.file.size, // Store file size
                    })),
                    pageCount,
                };
                sessionStorage.setItem('uploadedFileData', JSON.stringify(uploadData));
                
                // Navigate back to service page
                setShowUploadDialog(false);
                router.push(`/services/${categorySlug}`);
            } else {
                // Files are still uploading, wait for them to complete
                // The callback will be called again when uploads complete
                console.log('Files are still uploading, waiting for completion...');
            }
        }
    };

    const handleCloseUploadDialog = () => {
        setShowUploadDialog(false);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    onClick={handleBackToService}
                    className="mb-6 flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Service
                </Button>

                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
                            Choose a Template
                        </h1>
                        <p className="text-gray-600">
                            Select a template to customize for your order
                        </p>
                    </div>
                    
                    {loading && (
                        <div className="py-12 text-center text-gray-500">
                            Loading templates...
                        </div>
                    )}

                    {error && (
                        <div className="py-4 text-center text-red-600">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                                {/* Upload Image Card - First Option */}
                                <div
                                    className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all duration-200 cursor-pointer bg-white"
                                    onClick={handleUploadClick}
                                >
                                    <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                                        <div className="text-center w-full">
                                            <Upload className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-2" />
                                            <p className="text-xs sm:text-sm font-medium text-gray-600">Upload Image</p>
                                        </div>
                                    </div>
                                    <div className="p-3 sm:p-4">
                                        <h3 className="font-semibold text-gray-900 mb-1.5 text-sm sm:text-base">Upload Your Design</h3>
                                        <p className="text-xs text-gray-600 line-clamp-2">Upload your own image or document</p>
                                    </div>
                                </div>

                                {/* Template Cards */}
                                <TemplateGallery
                                    templates={templates}
                                    onTemplateSelect={handleTemplateClick}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Dialog for Template Form */}
                <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
                    <DialogContent className="relative max-w-5xl sm:max-w-6xl lg:max-w-7xl max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <DialogClose onClose={handleCloseDialog} />
                        {selectedTemplate && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                                {/* Left Side - Template Preview */}
                                <div className="">
                                    <div className="lg:sticky lg:top-4 bg-white">
                                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
                                            {selectedTemplate.name}
                                        </h2>
                                        {selectedTemplate.description && (
                                            <p className="text-xs sm:text-sm text-gray-600 mb-2">
                                                {selectedTemplate.description}
                                            </p>
                                        )}
                                        {selectedTemplate.previewImageUrl && (
                                            <div className="bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-200 max-w-xl">
                                                <div className="aspect-square flex items-center justify-center">
                                                    <img
                                                        src={getPublicS3Url(selectedTemplate.previewImageUrl)}
                                                        alt={selectedTemplate.name}
                                                        className="w-full h-full object-cover rounded"
                                                        loading="eager"
                                                        decoding="async"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side - Form */}
                                <div className="lg:border-l lg:border-gray-200 lg:pl-6">
                                    <TemplateForm
                                        template={selectedTemplate}
                                        initialData={formData}
                                        initialImages={formImages}
                                        onSubmit={handleFormSubmit}
                                        onBack={handleBackToGallery}
                                        onChangeTemplate={handleChangeTemplate}
                                    />
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Upload Dialog */}
                <Dialog open={showUploadDialog} onOpenChange={handleCloseUploadDialog}>
                    <DialogContent className="relative max-w-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <DialogClose onClose={handleCloseUploadDialog} />
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-900">Upload Your Design</h2>
                            <p className="text-sm text-gray-600">
                                Upload your image or document to use as your design
                            </p>
                            <ProductDocumentUpload
                                onFileSelect={handleFileSelect}
                                maxSizeMB={50}
                                uploadedFilesS3={uploadedFilesS3}
                                setUploadedFilesS3={setUploadedFilesS3}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
