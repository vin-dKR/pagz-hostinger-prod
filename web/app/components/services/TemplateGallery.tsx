'use client';

import React from 'react';
import { Button } from '@/app/components/ui/button';
import { type CategoryTemplate } from '@/lib/api/templates';
import { getPublicS3Url } from '@/lib/utils/s3';
import { FileText } from 'lucide-react';

interface TemplateGalleryProps {
    templates: CategoryTemplate[];
    onTemplateSelect: (template: CategoryTemplate) => void;
}

export function TemplateGallery({ templates, onTemplateSelect }: TemplateGalleryProps) {
    if (templates.length === 0) {
        return (
            <div className="py-12 text-center text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No templates available for this category.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
            {templates.map((template) => (
                <div
                    key={template.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-200 cursor-pointer bg-white"
                    onClick={() => onTemplateSelect(template)}
                >
                    {template.previewImageUrl ? (
                        <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                            <img
                                src={getPublicS3Url(template.previewImageUrl)}
                                alt={template.name}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                decoding="async"
                            />
                        </div>
                    ) : (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                            <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400" />
                        </div>
                    )}
                    <div className="p-3 sm:p-4">
                        <h3 className="font-semibold text-gray-900 mb-1.5 text-sm sm:text-base">{template.name}</h3>
                        {template.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                                {template.description}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
