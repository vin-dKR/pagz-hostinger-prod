import React from 'react';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

interface PageOption {
    value: string;
    label: string;
}

interface PagesSelectorProps {
    selectedPages: string;
    onSelect: (pages: string) => void;
    options: PageOption[];
    className?: string;
}

export const PagesSelector: React.FC<PagesSelectorProps> = ({
    selectedPages,
    onSelect,
    options,
    className,
}) => {
    return (
        <div className={cn('space-y-4', className)}>
            <h3 className="font-semibold text-lg flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Number of Pages
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onSelect(option.value)}
                        className={cn(
                            'p-4 border rounded-lg text-center',
                            'transition-all duration-200 hover:border-primary hover:shadow-sm',
                            selectedPages === option.value
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border text-foreground'
                        )}
                    >
                        <div className="font-medium">{option.label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};
