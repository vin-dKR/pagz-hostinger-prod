'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';

interface QuantityWithCopiesSelectorProps {
    quantity: number;
    copies: number;
    onQuantityChange: (value: number) => void;
    onCopiesChange: (value: number) => void;
    onModeChange?: (isCopiesMode: boolean) => void;
    min?: number;
    max?: number;
    label?: string;
    className?: string;
}

export const QuantityWithCopiesSelector: React.FC<QuantityWithCopiesSelectorProps> = ({
    quantity,
    copies,
    onQuantityChange,
    onCopiesChange,
    onModeChange,
    min = 1,
    max = 999,
    label = 'Quantity',
    className,
}) => {
    const [isCopiesMode, setIsCopiesMode] = useState(false);

    const handleModeToggle = () => {
        const newMode = !isCopiesMode;
        setIsCopiesMode(newMode);
        if (onModeChange) {
            onModeChange(newMode);
        }
    };

    const handleQuantityIncrement = () => {
        const newValue = quantity + 1;
        if (newValue <= max) {
            onQuantityChange(newValue);
        }
    };

    const handleQuantityDecrement = () => {
        const newValue = quantity - 1;
        if (newValue >= min) {
            onQuantityChange(newValue);
        } else {
            onQuantityChange(min);
        }
    };

    const handleCopiesIncrement = () => {
        const newValue = copies + 1;
        if (newValue <= max) {
            onCopiesChange(newValue);
        }
    };

    const handleCopiesDecrement = () => {
        const newValue = copies - 1;
        if (newValue >= min) {
            onCopiesChange(newValue);
        } else {
            onCopiesChange(min);
        }
    };

    const totalPages = quantity * copies;

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header with Quantity Label */}
            <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 font-hkgb">
                    {label} (Pages)
                </label>
            </div>

            {/* Quantity Selector (Always Visible) */}
            <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">
                    Number of Pages
                </label>
                <div className="flex items-start">
                    <div className="">
                        <div className="text-2xl sm:text-3xl font-hkgb text-gray-900">
                            0
                        </div>
                        <div className="text-sm text-gray-600">
                            {quantity === 1 ? 'page' : 'pages'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Copies Checkbox */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <input
                    type="checkbox"
                    id="copies-checkbox"
                    checked={isCopiesMode}
                    onChange={handleModeToggle}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label
                    htmlFor="copies-checkbox"
                    className="text-sm font-medium text-gray-700 cursor-pointer"
                >
                    Do you need copies?
                </label>
            </div>

            {/* Copies Selector (Only when checked) */}
            {isCopiesMode && (
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600">
                        Number of Copies
                    </label>
                    <div className="flex items-center gap-4 max-w-xs">
                        <button
                            type="button"
                            onClick={handleCopiesDecrement}
                            disabled={copies <= min}
                            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Decrease copies"
                        >
                            <Minus className="w-4 h-4" />
                        </button>

                        <div className="flex-1 text-center">
                            <div className="text-2xl sm:text-3xl font-hkgb text-gray-900">
                                {copies}
                            </div>
                            <div className="text-sm text-gray-600">
                                {copies === 1 ? 'copy' : 'copies'}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCopiesIncrement}
                            disabled={copies >= max}
                            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Increase copies"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Total Pages Display */}
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            <span className="font-semibold">Total Pages to Print:</span> {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                            <br />
                            <span className="text-xs text-blue-700">
                                ({quantity} {quantity === 1 ? 'page' : 'pages'} × {copies} {copies === 1 ? 'copy' : 'copies'})
                            </span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
