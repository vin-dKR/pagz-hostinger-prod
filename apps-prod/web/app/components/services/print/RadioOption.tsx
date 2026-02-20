import React from 'react';
import { cn } from '@/lib/utils';

interface RadioOptionProps {
    id: string;
    name: string;
    label: string;
    description?: string;
    value: string;
    checked: boolean;
    onChange: (value: string) => void;
    className?: string;
}

export const RadioOption: React.FC<RadioOptionProps> = ({
    id,
    name,
    label,
    description,
    value,
    checked,
    onChange,
    className,
}) => {
    return (
        <div className={cn('flex items-start space-x-3 p-4 border rounded-lg', className)}>
            <input
                type="radio"
                id={id}
                name={name}
                value={value}
                checked={checked}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 h-4 w-4 text-primary border-border focus:ring-primary"
            />
            <div className="flex-1">
                <label
                    htmlFor={id}
                    className="font-medium text-foreground cursor-pointer"
                >
                    {label}
                </label>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
            </div>
        </div>
    );
};
