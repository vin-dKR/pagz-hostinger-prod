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
    const [pendingUploadPageCount, setPendingUploadPageCount] = useState<number>(0);
    const [canContinueFromUpload, setCanContinueFromUpload] = useState(false);
    const [fileHasPassword, setFileHasPassword] = useState(false);
    const [filePassword, setFilePassword] = useState('');
    const [isPasswordSubmitted, setIsPasswordSubmitted] = useState(false);

    // Use TanStack Query for data fetching with caching
    const { 
        data: templates = [], 
        isLoading: loading, 
        error: queryError 
    } = useCategoryTemplates(categorySlug, true);

    const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load templates') : null;

    // Restore draft/template selection if user navigates away (e.g., login redirect) and comes back
    // Only restore if coming from edit action, not from initial navigation
    useEffect(() => {
        try {
            // Check if we're coming from an edit action (has selectedTemplateData flag)
            const isEditAction = sessionStorage.getItem('templateEditAction');
            if (!isEditAction) {
                // Clear any draft data if not from edit action to prevent auto-opening dialog
                sessionStorage.removeItem(`templateDraftData:${categorySlug}`);
                return;
            }
            
            const draft = sessionStorage.getItem(`templateDraftData:${categorySlug}`);
            if (!draft) {
                sessionStorage.removeItem('templateEditAction');
                return;
            }
            const data = JSON.parse(draft);
            if (data?.templateId && Array.isArray(templates) && templates.length > 0) {
                const tpl = templates.find(t => t.id === data.templateId) || null;
                if (tpl) {
                    setSelectedTemplate(tpl);
                    setFormData(data.formData || {});
                    setFormImages(data.formImages || []);
                    setDialogOpen(true);
                    sessionStorage.removeItem('templateEditAction');
                }
            }
        } catch (e) {
            // ignore draft parsing errors
            sessionStorage.removeItem('templateEditAction');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categorySlug, templates.length]);

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
            sessionStorage.removeItem(`templateDraftData:${categorySlug}`);
            
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
            setUploadedFilesS3(fileDetails);
            setPendingUploadPageCount(pageCount || 0);
            // Check if all files have been uploaded (have s3Key)
            const allFilesUploaded = fileDetails.every(fd => fd.uploadStatus === 'uploaded' && fd.s3Key);
            
            if (allFilesUploaded) {
                setCanContinueFromUpload(true);
            } else {
                // Files are still uploading, wait for them to complete
                // The callback will be called again when uploads complete
                setCanContinueFromUpload(false);
            }
        }
    };

    const handleContinueFromUpload = () => {
        const completed = uploadedFilesS3.filter(fd => fd.uploadStatus === 'uploaded' && fd.s3Key);
        if (completed.length === 0) return;

        const uploadData = {
            uploadedFiles: completed.map(fd => ({
                name: fd.file.name,
                s3Key: fd.s3Key,
                type: fd.type,
                pageCount: fd.pageCount,
                id: fd.id,
                size: fd.file.size,
            })),
            pageCount: pendingUploadPageCount,
            fileHasPassword: fileHasPassword ? true : undefined,
            filePassword: fileHasPassword && filePassword ? filePassword : undefined,
            isPasswordSubmitted: fileHasPassword && filePassword ? isPasswordSubmitted : undefined,
        };
        sessionStorage.setItem('uploadedFileData', JSON.stringify(uploadData));
        setShowUploadDialog(false);
        router.push(`/services/${categorySlug}`);
    };

    const handleCloseUploadDialog = () => {
        setShowUploadDialog(false);
        setCanContinueFromUpload(false);
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
                                        onDraftChange={(data, images) => {
                                            try {
                                                sessionStorage.setItem(
                                                    `templateDraftData:${categorySlug}`,
                                                    JSON.stringify({
                                                        templateId: selectedTemplate.id,
                                                        formData: data,
                                                        formImages: images,
                                                    })
                                                );
                                            } catch (e) {
                                                // ignore quota errors
                                            }
                                        }}
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
                            
                            {/* Password-protected file info */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="file-has-password-template"
                                        checked={fileHasPassword}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setFileHasPassword(checked);
                                            if (!checked) {
                                                setFilePassword('');
                                                setIsPasswordSubmitted(false);
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="file-has-password-template" className="text-sm font-medium text-gray-700 cursor-pointer">
                                        File has password?
                                    </label>
                                </div>

                                {fileHasPassword && (
                                    <div className="mt-3">
                                        {!isPasswordSubmitted ? (
                                            <>
                                                <label htmlFor="file-password-template" className="block text-xs font-medium text-gray-600 mb-1">
                                                    Enter password (shared with admin)
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        id="file-password-template"
                                                        type="text"
                                                        value={filePassword}
                                                        onChange={(e) => setFilePassword(e.target.value)}
                                                        placeholder="e.g. 1234"
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                    />
                                                    <Button
                                                        onClick={() => {
                                                            if (filePassword.trim()) {
                                                                setIsPasswordSubmitted(true);
                                                            }
                                                        }}
                                                        disabled={!filePassword.trim()}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Submit
                                                    </Button>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">
                                                    Only enter this if your PDF/document is password protected.
                                                </p>
                                            </>
                                        ) : (
                                            <div className="space-y-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Password (shared with admin)
                                                </label>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="password"
                                                        value={filePassword}
                                                        readOnly
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 text-sm font-mono"
                                                    />
                                                    <Button
                                                        onClick={() => setIsPasswordSubmitted(false)}
                                                        variant="outline"
                                                        className="px-4 py-2"
                                                    >
                                                        Edit
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Password is saved. Click Edit to change it.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={handleCloseUploadDialog}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleContinueFromUpload}
                                    disabled={!canContinueFromUpload}
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
