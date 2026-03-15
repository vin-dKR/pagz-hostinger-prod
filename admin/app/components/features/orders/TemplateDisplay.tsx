'use client';

import { useState, useEffect } from 'react';
import { getCategoryTemplate } from '@/lib/api/categoryTemplates.service';
import { getPublicS3Url } from '@/lib/utils/s3';
import { Download, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { imageLoader } from '@/lib/utils/image-loader';

interface TemplateDisplayProps {
    templateId: string;
    categoryId?: string;
    formData?: Record<string, any>;
    formImages?: string[];
}

export function TemplateDisplay({ templateId, categoryId, formData, formImages }: TemplateDisplayProps) {
    const [template, setTemplate] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (templateId && categoryId) {
            loadTemplate();
        }
    }, [templateId, categoryId]);

    const loadTemplate = async () => {
        if (!categoryId) return;
        try {
            setLoading(true);
            setError(null);
            const templateData = await getCategoryTemplate(categoryId, templateId);
            setTemplate(templateData);
        } catch (err) {
            console.error('Failed to load template:', err);
            setError(err instanceof Error ? err.message : 'Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        if (template?.previewImageUrl) {
            const imageUrl = getPublicS3Url(template.previewImageUrl);
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `${template.name || 'template'}-preview.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
            <p className="text-xs font-semibold text-purple-900 mb-2">Template Selected:</p>
            
            {loading && (
                <p className="text-[11px] text-purple-700">Loading template...</p>
            )}
            
            {error && (
                <p className="text-[11px] text-red-700">Error: {error}</p>
            )}
            
            {template && (
                <>
                    {template.previewImageUrl && (
                        <div className="mb-2">
                            <div className="relative w-full h-32 bg-gray-100 rounded overflow-hidden mb-2">
                                <Image
                                    src={getPublicS3Url(template.previewImageUrl)}
                                    alt={template.name || 'Template preview'}
                                    fill
                                    className="object-cover"
                                    loader={imageLoader}
                                />
                            </div>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-1 px-2 py-1 text-[11px] bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                            >
                                <Download className="w-3 h-3" />
                                Download Template
                            </button>
                        </div>
                    )}
                    {template.name && (
                        <p className="text-[11px] text-purple-700 mb-2">
                            <strong>Template:</strong> {template.name}
                        </p>
                    )}
                </>
            )}
            
            {!categoryId && (
                <p className="text-[11px] text-purple-700 mb-2">
                    <strong>Template ID:</strong> {templateId}
                </p>
            )}
            
            {formData && Object.keys(formData).length > 0 && (
                <div className="mb-2">
                    <p className="text-[11px] font-semibold text-purple-800 mb-1">Form Data:</p>
                    {Object.entries(formData).map(([key, value], idx) => (
                        <p key={idx} className="text-[11px] text-purple-700">
                            <strong>{key}:</strong> {String(value)}
                        </p>
                    ))}
                </div>
            )}
            
            {formImages && formImages.length > 0 && (
                <div>
                    <div className="flex items-center gap-1 mb-1">
                        <ImageIcon className="w-3 h-3 text-purple-800" />
                        <p className="text-[11px] font-semibold text-purple-800">Form Images ({formImages.length}):</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        {formImages.map((imgUrl: string, idx: number) => (
                            <a
                                key={idx}
                                href={getPublicS3Url(imgUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative aspect-square bg-gray-100 rounded overflow-hidden hover:opacity-80 transition-opacity"
                            >
                                <Image
                                    src={getPublicS3Url(imgUrl)}
                                    alt={`Form image ${idx + 1}`}
                                    fill
                                    className="object-cover"
                                    loader={imageLoader}
                                />
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
