'use client';

/**
 * Tabs Components
 */

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface TabsContextValue {
    value: string;
    onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

interface TabsProps {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn('w-full', className)}>{children}</div>
        </TabsContext.Provider>
    );
};

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
    return (
        <div
            className={cn(
                'inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-[var(--color-background-secondary)] p-1',
                className
            )}
        >
            {children}
        </div>
    );
};

export const TabsTrigger: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({
    value,
    children,
    className,
}) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used within Tabs');

    const isActive = context.value === value;

    return (
        <button
            onClick={() => context.onValueChange(value)}
            className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                isActive
                    ? 'bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm'
                    : 'text-[var(--color-foreground-secondary)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]',
                className
            )}
        >
            {children}
        </button>
    );
};

export const TabsContent: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({
    value,
    children,
    className,
}) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsContent must be used within Tabs');

    if (context.value !== value) return null;

    return (
        <div className={cn('mt-4 focus-visible:outline-none', className)}>
            {children}
        </div>
    );
};

