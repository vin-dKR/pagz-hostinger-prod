'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus, Copy } from 'lucide-react';

interface CopiesSelectorProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    className?: string;
}

export const CopiesSelector: React.FC<CopiesSelectorProps> = ({
    value,
    onChange,
    min = 1,
    max = 999,
    className,
}) => {
    const increment = () => {
        const newValue = value + 1;
        if (newValue <= max) {
            onChange(newValue);
        }
    };

    const decrement = () => {
        const newValue = value - 1;
        if (newValue >= min) {
            onChange(newValue);
        } else {
            onChange(min);
        }
    };

    return (
        <div className={cn('space-y-3', className)}>
            <label className="block text-sm font-medium text-gray-700 mb-3 font-hkgb flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Copies
            </label>

            <div className="flex items-center gap-4 max-w-xs">
                <button
                    type="button"
                    onClick={decrement}
                    disabled={value <= min}
                    className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease copies"
                >
                    <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 text-center">
                    <div className="text-2xl sm:text-3xl font-hkgb text-gray-900">
                        {value}
                    </div>
                    <div className="text-sm text-gray-600">
                        {value === 1 ? 'copy' : 'copies'}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={increment}
                    disabled={value >= max}
                    className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Increase copies"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <p className="text-xs text-gray-500">
                Number of copies to print
            </p>
        </div>
    );
};

