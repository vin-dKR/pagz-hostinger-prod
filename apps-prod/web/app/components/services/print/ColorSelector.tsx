import React from 'react';
import { cn } from '@/lib/utils';
import { Printer } from 'lucide-react';

interface ColorOption {
    id: 'bwSingle' | 'bwBoth' | 'colorSingle' | 'colorBoth';
    label: string;
    description: string;
    icon: React.ReactNode;
}

interface ColorSelectorProps {
    selectedColor: string;
    onSelect: (colorType: 'bwSingle' | 'bwBoth' | 'colorSingle' | 'colorBoth') => void;
    className?: string;
}

export const ColorSelector: React.FC<ColorSelectorProps> = ({
    selectedColor,
    onSelect,
    className,
}) => {
    const colorOptions: ColorOption[] = [
        {
            id: 'bwSingle',
            label: 'Black & White',
            description: 'Single Side',
            icon: <Printer className="h-5 w-5" />,
        },
        {
            id: 'bwBoth',
            label: 'Black & White',
            description: 'Both Sides',
            icon: <Printer className="h-5 w-5" />,
        },
        {
            id: 'colorSingle',
            label: 'Color',
            description: 'Single Side',
            icon: (
                <div className="flex space-x-1">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
            ),
        },
        {
            id: 'colorBoth',
            label: 'Color',
            description: 'Both Sides',
            icon: (
                <div className="flex space-x-1">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
            ),
        },
    ];

    return (
        <div className={cn('space-y-4', className)}>
            <h3 className="font-semibold text-lg">Print Color & Sides</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {colorOptions.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            'p-4 border rounded-lg flex flex-col items-center justify-center space-y-2',
                            'transition-all duration-200 hover:border-primary hover:shadow-sm',
                            selectedColor === option.id
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border text-foreground'
                        )}
                    >
                        <div className="mb-2">{option.icon}</div>
                        <div className="font-medium text-center">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};
