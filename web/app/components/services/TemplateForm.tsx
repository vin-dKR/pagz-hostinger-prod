'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { type CategoryTemplate, type FormField } from '@/lib/api/templates';
import { uploadOrderFilesToS3 } from '@/lib/api/uploads';
import { toastError, toastSuccess, toastWarning } from '@/lib/utils/toast';
import { assertNonEmptyFiles, EmptyFilesError } from '@/lib/utils/file-validation';
import { getPublicS3Url } from '@/lib/utils/s3';
import { ArrowLeft, X } from 'lucide-react';

interface TemplateFormProps {
    template: CategoryTemplate;
    initialData?: Record<string, any>;
    initialImages?: string[];
    onSubmit: (data: Record<string, any>, images: string[]) => void;
    onDraftChange?: (data: Record<string, any>, images: string[]) => void;
    onBack: () => void;
    onChangeTemplate: () => void;
}

export function TemplateForm({
    template,
    initialData = {},
    initialImages = [],
    onSubmit,
    onDraftChange,
    onBack,
    onChangeTemplate,
}: TemplateFormProps) {
    const [formData, setFormData] = useState<Record<string, any>>(initialData);
    const [formImages, setFormImages] = useState<string[]>(initialImages);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const form = template.form;
    const fields = form?.fields || [];

    useEffect(() => {
        setFormData(initialData);
        setFormImages(initialImages);
    }, [initialData, initialImages]);

    // Persist draft while typing (so navigation/login redirect won’t wipe it)
    useEffect(() => {
        if (!onDraftChange) return;
        onDraftChange(formData, formImages);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, formImages]);

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData((prev) => ({ ...prev, [fieldId]: value }));
        // Clear error for this field
        if (errors[fieldId]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const validateField = (field: FormField, value: any): string | null => {
        if (field.isRequired && (value === undefined || value === null || value === '')) {
            return `${field.label} is required`;
        }

        if (value === undefined || value === null || value === '') {
            return null; // Optional fields can be empty
        }

        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return 'Please enter a valid email address';
            }
        }

        if (field.type === 'phone' && value) {
            const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
            if (!phoneRegex.test(value)) {
                return 'Please enter a valid phone number';
            }
        }

        if (field.type === 'number' && value !== undefined && value !== null && value !== '') {
            const numValue = Number(value);
            if (isNaN(numValue)) {
                return 'Please enter a valid number';
            }
            if (field.validation?.min !== undefined && numValue < field.validation.min) {
                return `Value must be at least ${field.validation.min}`;
            }
            if (field.validation?.max !== undefined && numValue > field.validation.max) {
                return `Value must be at most ${field.validation.max}`;
            }
        }

        if (field.validation?.minLength && value.length < field.validation.minLength) {
            return `Must be at least ${field.validation.minLength} characters`;
        }

        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
            return `Must be at most ${field.validation.maxLength} characters`;
        }

        if (field.validation?.pattern && value) {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
                return 'Invalid format';
            }
        }

        return null;
    };

    const handleImageUpload = async (files: File[]) => {
        if (files.length === 0) return;

        // Issue #56: stop 0-byte files at the source so the user sees an
        // actionable per-file message instead of a generic upload failure
        // after a round-trip — and so the server never has to defend
        // against this in the first place.
        try {
            assertNonEmptyFiles(files);
        } catch (err) {
            if (err instanceof EmptyFilesError) {
                toastError(err.message);
                return;
            }
            throw err;
        }

        try {
            setUploadingImages(true);
            const response = await uploadOrderFilesToS3(files);
            if (response.success && response.data?.files) {
                const newImageUrls = response.data.files.map((f) => f.key);
                setFormImages((prev) => [...prev, ...newImageUrls]);

                // Surface partial-success state: keep the uploaded ones,
                // tell the user exactly which files failed so they can
                // re-select only those instead of resubmitting the batch.
                const failures = response.data.failures ?? [];
                if (failures.length > 0) {
                    toastWarning(
                        `Uploaded ${newImageUrls.length} of ${files.length}. Failed: ${failures.map((f) => f.originalName).join(', ')}`,
                        6000,
                    );
                } else {
                    toastSuccess('Images uploaded successfully');
                }
            } else {
                toastError(response.error || 'Failed to upload images');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            toastError('Failed to upload images');
        } finally {
            setUploadingImages(false);
        }
    };

    const handleRemoveImage = (index: number) => {
        setFormImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        const newErrors: Record<string, string> = {};

        // Validate all fields
        fields.forEach((field) => {
            const value = formData[field.id || field.label];
            const error = validateField(field, value);
            if (error) {
                newErrors[field.id || field.label] = error;
            }
        });

        // Validate image upload if required
        if (form?.requiresImageUpload) {
            if (form.imageUploadRequired && formImages.length === 0) {
                newErrors._images = 'Image upload is required';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit(formData, formImages);
    };

    const renderField = (field: FormField) => {
        const fieldId = field.id || field.label;
        const value = formData[fieldId] || '';
        const error = errors[fieldId];

        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
                return (
                    <div key={fieldId} className="space-y-1 sm:space-y-2">
                        <label htmlFor={fieldId} className="block text-xs sm:text-sm font-medium text-gray-700">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                            value={value}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(fieldId, e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full rounded-md border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'number':
                return (
                    <div key={fieldId} className="space-y-1 sm:space-y-2">
                        <label htmlFor={fieldId} className="block text-xs sm:text-sm font-medium text-gray-700">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type="number"
                            value={value}
                            onChange={(e) => handleFieldChange(fieldId, e.target.value ? Number(e.target.value) : '')}
                            placeholder={field.placeholder}
                            min={field.validation?.min}
                            max={field.validation?.max}
                            className={`w-full rounded-md border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'textarea':
                return (
                    <div key={fieldId} className="space-y-1 sm:space-y-2">
                        <label htmlFor={fieldId} className="block text-xs sm:text-sm font-medium text-gray-700">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <textarea
                            id={fieldId}
                            value={value}
                            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className={`w-full rounded-md border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:rows-4 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'select':
                return (
                    <div key={fieldId} className="space-y-1 sm:space-y-2">
                        <label htmlFor={fieldId} className="block text-xs sm:text-sm font-medium text-gray-700">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                            id={fieldId}
                            value={value}
                            onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                            className={`w-full rounded-md border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                        >
                            <option value="">Select {field.label}</option>
                            {field.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}
                    </div>
                );

            case 'checkbox':
                return (
                    <div key={fieldId} className="flex items-center space-x-2">
                        <input
                            id={fieldId}
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => handleFieldChange(fieldId, e.target.checked)}
                            className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={fieldId} className="cursor-pointer text-xs sm:text-sm font-medium text-gray-700">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {error && <p className="text-xs sm:text-sm text-red-600 ml-4 sm:ml-6">{error}</p>}
                    </div>
                );

            case 'file':
                return (
                    <div key={fieldId} className="space-y-1 sm:space-y-2">
                        <label htmlFor={fieldId} className="block text-xs sm:text-sm font-medium text-gray-700">
                            {field.label}
                            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            id={fieldId}
                            type="file"
                            onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) {
                                    handleFieldChange(fieldId, files[0]);
                                }
                            }}
                            className={`w-full rounded-md border px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="space-y-3 sm:space-y-6">
            <div className="flex items-center justify-between pb-2 sm:pb-4 border-b border-gray-200">
                <Button variant="ghost" onClick={onBack} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                    <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Back to Templates</span>
                    <span className="sm:hidden">Back</span>
                </Button>
            </div>

            <div className="space-y-3 sm:space-y-4">
                {fields.map((field) => renderField(field))}
            </div>

            {form?.requiresImageUpload && (
                <div className="space-y-1 sm:space-y-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">
                        Images
                        {form.imageUploadRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="space-y-1 sm:space-y-2">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                    handleImageUpload(files);
                                }
                            }}
                            disabled={uploadingImages}
                            className="w-full rounded-md border border-gray-300 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {uploadingImages && (
                            <p className="text-xs sm:text-sm text-gray-500">Uploading images...</p>
                        )}
                        {formImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                                {formImages.map((imageUrl, index) => (
                                    <div key={index} className="relative group">
                                        <img
                                            src={getPublicS3Url(imageUrl)}
                                            alt={`Upload ${index + 1}`}
                                            className="w-full h-16 sm:h-24 object-cover rounded"
                                        />
                                        <button
                                            onClick={() => handleRemoveImage(index)}
                                            className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-red-500 text-white rounded-full p-0.5 sm:p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {errors._images && (
                            <p className="text-xs sm:text-sm text-red-600">{errors._images}</p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2 sm:pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={onBack} className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl">
                    Submit
                </Button>
            </div>
        </div>
    );
}
