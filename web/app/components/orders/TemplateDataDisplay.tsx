'use client';

import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { getPublicS3Url } from '@/lib/utils/s3';

interface TemplateDataDisplayProps {
    templateId?: string;
    templateName?: string;
    templatePreviewImage?: string;
    formData?: Record<string, any>;
    formImages?: string[];
}

export function TemplateDataDisplay({
    templateId,
    templateName,
    templatePreviewImage,
    formData,
    formImages,
}: TemplateDataDisplayProps) {
    if (!templateId && !templateName) {
        return null;
    }

    return (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="font-medium text-blue-900">Template Information</h4>
            </div>

            {templatePreviewImage && (
                <div className="mb-3">
                    <img
                        src={templatePreviewImage}
                        alt={templateName || 'Template preview'}
                        className="w-full h-32 object-cover rounded"
                    />
                </div>
            )}

            {templateName && (
                <p className="text-sm font-medium text-gray-900 mb-2">
                    Template: <span className="text-gray-700">{templateName}</span>
                </p>
            )}

            {formData && Object.keys(formData).length > 0 && (
                <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                        Form Data
                    </p>
                    <div className="space-y-1.5">
                        {Object.entries(formData).map(([key, value]) => {
                            if (value === null || value === undefined || value === '') {
                                return null;
                            }
                            return (
                                <div key={key} className="text-sm">
                                    <span className="font-medium text-gray-700">{key}:</span>{' '}
                                    <span className="text-gray-600">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {formImages && formImages.length > 0 && (
                <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                            Uploaded Images ({formImages.length})
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {formImages.map((imageUrl, index) => (
                            <div key={index} className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                                <img
                                    src={getPublicS3Url(imageUrl)}
                                    alt={`Form image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
