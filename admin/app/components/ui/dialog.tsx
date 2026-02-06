'use client';

/**
 * Dialog Components
 * Apple-inspired modal dialogs with subtle backdrop and smooth animations
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils/cn';

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

interface DialogContentProps {
    children: React.ReactNode;
    className?: string;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm"
                onClick={() => onOpenChange?.(false)}
            />
            <div className="relative z-50 animate-in zoom-in-95 duration-200">
                {children}
            </div>
        </div>
    );
};

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
    return (
        <div className={cn(
            'bg-[var(--color-popover)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[var(--color-border)]',
            className
        )}>
            {children}
        </div>
    );
};

export const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div className="mb-6">{children}</div>;
};

export const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <h2 className="text-xl font-semibold text-[var(--color-foreground)] leading-tight">{children}</h2>;
};

export const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <p className="text-sm text-[var(--color-foreground-secondary)] mt-2 leading-relaxed">{children}</p>;
};

export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div className="mt-6 flex justify-end gap-3">{children}</div>;
};

export const DialogClose: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-[var(--color-foreground-secondary)] hover:text-[var(--color-foreground)]"
            onClick={onClose}
        >
            <X className="h-4 w-4" />
        </Button>
    );
};

