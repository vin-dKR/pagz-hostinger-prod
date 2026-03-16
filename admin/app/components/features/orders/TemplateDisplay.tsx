'use client';

import { useState, useEffect } from 'react';
import { getCategoryTemplate } from '@/lib/api/categoryTemplates.service';
import { getPublicS3Url } from '@/lib/utils/s3';
import { Download, Image as ImageIcon, Copy, Check } from 'lucide-react';
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
    const [copiedField, setCopiedField] = useState<string | null>(null);

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
            window.open(imageUrl, '_blank');
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

            {/* Image and Form Data in Row */}
            {(template?.previewImageUrl || (formData && Object.keys(formData).length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    {/* Template Image */}
                    {template?.previewImageUrl && (
                        <div className="flex flex-col">
                            <div className="relative w-full h-full bg-gray-100 rounded overflow-hidden mb-2">
                                <Image
                                    src={getPublicS3Url(template.previewImageUrl)}
                                    alt={template.name || 'Template preview'}
                                    fill
                                    className="object-contain"
                                    loader={imageLoader}
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                />
                            </div>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors w-full sm:w-auto"
                            >
                                <Download className="w-3 h-3" />
                                Download Template
                            </button>
                        </div>
                    )}

                    {/* Form Data */}
                    {formData && Object.keys(formData).length > 0 && (
                        <div className="flex flex-col justify-start">
                            <p className="text-sm font-semibold text-purple-900 mb-2 uppercase tracking-wide">Form Data:</p>
                            <div className="bg-white rounded-lg border border-purple-200 p-3 space-y-2.5 print:border-2 print:border-gray-800">
                                {Object.entries(formData).map(([key, value], idx) => {
                                    const fieldId = `form-field-${idx}`;
                                    const valueStr = String(value);
                                    const isCopied = copiedField === fieldId;

                                    const handleCopy = async () => {
                                        try {
                                            await navigator.clipboard.writeText(valueStr);
                                            setCopiedField(fieldId);
                                            setTimeout(() => setCopiedField(null), 2000);
                                        } catch (err) {
                                            console.error('Failed to copy:', err);
                                        }
                                    };

                                    return (
                                        <div
                                            key={idx}
                                            className="group flex items-start justify-between gap-2 p-2 rounded hover:bg-purple-50 transition-colors border-b border-purple-100 last:border-b-0 print:border-gray-300 print:break-inside-avoid"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-purple-900 mb-1 uppercase tracking-wide print:text-sm print:font-bold">
                                                    {key}:
                                                </p>
                                                <p
                                                    className="text-sm text-gray-900 font-medium select-all break-words print:text-base print:font-semibold"
                                                    id={fieldId}
                                                >
                                                    {valueStr}
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleCopy}
                                                className="shrink-0 p-1.5 rounded hover:bg-purple-200 transition-colors print:hidden"
                                                title={`Copy ${key}`}
                                                aria-label={`Copy ${key} value`}
                                            >
                                                {isCopied ? (
                                                    <Check className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <Copy className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Form Images - Full Width */}
            {formImages && formImages.length > 0 && (
                <div className="mt-2">
                    <div className="flex items-center gap-1 mb-1">
                        <ImageIcon className="w-3 h-3 text-purple-800" />
                        <p className="text-[11px] font-semibold text-purple-800">Form Images ({formImages.length}):</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                    sizes="(max-width: 640px) 50vw, 33vw"
                                />
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
