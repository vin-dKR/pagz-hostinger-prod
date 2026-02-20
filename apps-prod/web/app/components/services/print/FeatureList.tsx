import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Feature } from '../../../../types';

interface FeatureListProps {
    features: Feature[];
    title?: string;
    className?: string;
}

export const FeatureList: React.FC<FeatureListProps> = ({
    features,
    title,
    className,
}) => {
    return (
        <div className={cn('space-y-4', className)}>
            {title && (
                <h3 className="font-semibold text-lg text-foreground">{title}</h3>
            )}
            <ul className="space-y-3">
                {features.map((feature) => (
                    <li key={feature.id} className="flex items-start">
                        <Check className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature.text}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
