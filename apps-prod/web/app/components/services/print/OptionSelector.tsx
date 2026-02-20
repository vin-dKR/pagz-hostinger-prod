'use client';

import React from 'react';
import { Option } from '@/types';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface OptionSelectorProps {
    title: string;
    options: Option[];
    selectedValue?: string;
    onSelect: (value: string) => void;
    layout?: 'grid' | 'inline' | 'list';
    columns?: number;
    showPrice?: boolean;
    className?: string;
}

export const OptionSelector: React.FC<OptionSelectorProps> = ({
    title,
    options,
    selectedValue,
    onSelect,
    layout = 'grid',
    columns = 4,
    showPrice = true,
    className,
}) => {
    const gridCols = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 sm:grid-cols-4',
        5: 'grid-cols-2 sm:grid-cols-5',
        6: 'grid-cols-3 sm:grid-cols-6',
    };

    return (
        <div className={cn('space-y-4', className)}>
            <label className="block text-sm font-medium text-gray-700 mb-3 font-hkgb">
                {title}
            </label>

            {layout === 'inline' ? (
                <div className="flex flex-wrap gap-3">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.value)}
                            disabled={option.disabled}
                            className={cn(
                                'px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border text-sm sm:text-base font-medium transition-all duration-200',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                selectedValue === option.value
                                    ? 'border-[#008ECC] bg-[#008ECC] text-white'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            ) : layout === 'list' ? (
                <div className="space-y-3">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.value)}
                            disabled={option.disabled}
                            className={cn(
                                'w-full p-4 rounded-xl border flex items-center justify-between transition-all duration-200',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                selectedValue === option.value
                                    ? 'border-[#008ECC] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            )}
                        >
                            <div className="text-left">
                                <div className="font-medium text-gray-900 text-sm sm:text-base">
                                    {option.label}
                                </div>
                                {option.description && (
                                    <div className="text-gray-600 text-xs sm:text-sm mt-1">
                                        {option.description}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {showPrice && option.price !== undefined && (
                                    <div className="font-hkgb text-[#008ECC] text-sm sm:text-base">
                                        ₹{option.price.toFixed(2)}
                                    </div>
                                )}
                                {selectedValue === option.value && (
                                    <Check className="w-5 h-5 text-[#008ECC]" />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className={cn('grid gap-3', gridCols[columns as keyof typeof gridCols])}>
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.value)}
                            disabled={option.disabled}
                            className={cn(
                                'p-3 sm:p-4 rounded-xl border text-center transition-all duration-200',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                selectedValue === option.value
                                    ? 'border-[#008ECC] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            )}
                        >
                            <div className="font-medium text-gray-900 text-sm sm:text-base mb-1">
                                {option.label}
                            </div>
                            {showPrice && option.price !== undefined && (
                                <div className="text-xs sm:text-sm text-gray-600">
                                    ₹{option.price.toFixed(2)}
                                </div>
                            )}
                            {option.description && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {option.description}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
