'use client';

import React from 'react';
import { FileText, Image, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageCountDisplayProps {
    pageCount: number;
    fileType?: 'pdf' | 'image' | 'mixed';
    pdfPageCount?: number;
    imageCount?: number;
    className?: string;
}

export const PageCountDisplay: React.FC<PageCountDisplayProps> = ({
    pageCount,
    fileType = 'pdf',
    pdfPageCount,
    imageCount,
    className,
}) => {
    const getIcon = () => {
        if (fileType === 'image') return <Image className="w-5 h-5" />;
        if (fileType === 'mixed') return <FileText className="w-5 h-5" />;
        return <FileText className="w-5 h-5" />;
    };

    const showBreakdown = pdfPageCount !== undefined && imageCount !== undefined;

    return (
        <div className={cn('space-y-2', className)}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3 font-hkgb">
                Pages (from uploaded files)
                <Lock className="w-4 h-4 text-gray-400" />
            </label>
            <div className="p-4 bg-gray-50 border-2 border-gray-300 rounded-lg opacity-75">
                <div className="flex items-center gap-3 mb-3">
                    <div className="text-gray-500">
                        {getIcon()}
                    </div>
                    <div className="flex-1">
                        <div className="text-2xl sm:text-3xl font-hkgb text-gray-900">
                            {pageCount}
                        </div>
                        <div className="text-sm text-gray-600">
                            {pageCount === 1 ? 'page' : 'pages'} (auto-calculated)
                        </div>
                    </div>
                    <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-300 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Read-only
                    </div>
                </div>

                {showBreakdown && (
                    <div className="mt-3 pt-3 border-t border-gray-300 text-xs text-gray-600 space-y-1">
                        <div className="font-medium text-gray-700 mb-1">Breakdown:</div>
                        {pdfPageCount > 0 && (
                            <div>• {pdfPageCount} {pdfPageCount === 1 ? 'page' : 'pages'} from PDF files</div>
                        )}
                        {imageCount > 0 && (
                            <div>• {imageCount} {imageCount === 1 ? 'image' : 'images'} ({imageCount} {imageCount === 1 ? 'page' : 'pages'})</div>
                        )}
                        <div className="font-medium text-gray-700 mt-1">
                            Total: {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                        </div>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-500 italic">
                This value is automatically calculated from your uploaded files and cannot be changed manually
            </p>
        </div>
    );
};

