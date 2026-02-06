import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}

interface CardComponent extends React.FC<CardProps> {
    Header: React.FC<{ children: React.ReactNode; className?: string; }>;
    Content: React.FC<{ children: React.ReactNode; className?: string; }>;
}

export const Card: CardComponent = ({
    children,
    className,
    hover = true,
}) => {
    return (
        <div
            className={cn(
                'bg-card text-card-foreground rounded-xl border shadow-sm',
                hover && 'transition-all duration-200 hover:shadow-md',
                className
            )}
        >
            {children}
        </div>
    );
};

// Assign sub-components to Card
Card.Header = function CardHeader({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('p-6 pb-3', className)}>
            {children}
        </div>
    );
};

Card.Content = function CardContent({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('p-6 pt-3', className)}>
            {children}
        </div>
    );
};
