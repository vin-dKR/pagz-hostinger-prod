'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    unit?: string;
    className?: string;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
    value,
    onChange,
    min = 1,
    max = 999,
    step = 1,
    label = 'Quantity',
    unit = 'pages',
    className,
}) => {
    const increment = () => {
        const newValue = value + step;
        if (newValue <= max) {
            onChange(newValue);
        }
    };

    const decrement = () => {
        const newValue = value - step;
        // Prevent decreasing below minimum
        if (newValue >= min) {
            onChange(newValue);
        } else {
            // If trying to go below min, set to min
            onChange(min);
        }
    };

    return (
        <div className={cn('space-y-3', className)}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-3 font-hkgb">
                    {label}
                </label>
            )}

            <div className="flex items-center gap-4 max-w-xs">
                <button
                    type="button"
                    onClick={decrement}
                    disabled={value <= min}
                    className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 text-center">
                    <div className="text-2xl sm:text-3xl font-hkgb text-gray-900">
                        {value}
                    </div>
                    <div className="text-sm text-gray-600">
                        {unit}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={increment}
                    disabled={value >= max}
                    className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
