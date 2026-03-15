'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    description?: string;
    price?: number;
    recommended?: boolean;
    disabled?: boolean;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    error?: boolean;
    required?: boolean;
}

export function Select({
    value,
    onChange,
    options,
    placeholder = 'Select an option',
    className = '',
    error = false,
    required = false,
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        if (optionValue !== value) {
            onChange(optionValue);
        }
        setIsOpen(false);
    };

    return (
        <div ref={selectRef} className={`relative ${className}`}>
            {/* Select Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 pr-10 border-2 rounded-xl focus:ring-2 focus:ring-[#008ECC] focus:border-[#008ECC] bg-white text-gray-900 text-sm sm:text-base cursor-pointer transition-all duration-200 hover:border-gray-400 flex items-center justify-between ${
                    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
            >
                <span className="truncate">
                    {selectedOption ? (
                        <span>
                            {selectedOption.label}
                            {selectedOption.price !== undefined && (
                                <span className="text-gray-500 ml-2">
                                    (₹{selectedOption.price.toFixed(2)} / unit)
                                </span>
                            )}
                        </span>
                    ) : (
                        <span className="text-gray-500">{placeholder}</span>
                    )}
                </span>
                <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isOpen ? 'transform rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown List */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 p-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-64 overflow-auto scrollbar-thin">
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => !option.disabled && handleSelect(option.value)}
                                disabled={option.disabled}
                                className={`w-full px-4 py-3 text-left transition-colors duration-150 flex items-center justify-between ${
                                    isSelected
                                        ? 'bg-blue-50 border-2 border-[#008ECC] rounded-lg'
                                        : 'hover:bg-gray-50 border-2 border-transparent rounded-lg'
                                } ${
                                    option.disabled
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer'
                                } ${option.value === options[0]?.value && !isSelected ? 'rounded-t-xl' : ''} ${
                                    option.value === options[options.length - 1]?.value && !isSelected
                                        ? 'rounded-b-xl'
                                        : ''
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm sm:text-base font-medium text-gray-900">
                                            {option.label}
                                        </span>
                                        {option.recommended && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    {option.price !== undefined && (
                                        <span className="text-sm text-gray-500 mt-0.5 block">
                                            ₹{option.price.toFixed(2)} / unit
                                        </span>
                                    )}
                                    {option.description && (
                                        <span className="text-xs text-gray-500 mt-0.5 block">
                                            {option.description}
                                        </span>
                                    )}
                                </div>
                                {isSelected && (
                                    <Check className="w-5 h-5 text-[#008ECC] shrink-0 ml-2" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
