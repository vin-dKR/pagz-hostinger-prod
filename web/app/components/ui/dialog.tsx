'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

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
    // Disable body scroll when dialog is open
    React.useEffect(() => {
        if (open) {
            // Save the current scroll position
            const scrollY = window.scrollY;
            // Disable scroll
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
            
            return () => {
                // Re-enable scroll when dialog closes
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                // Restore scroll position
                window.scrollTo(0, scrollY);
            };
        }
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 pt-16 sm:pt-20 pb-4">
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={() => onOpenChange?.(false)}
            />
            <div className="relative z-[200] flex items-center justify-center">
                {children}
            </div>
        </div>
    );
};

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
    // Default to max-w-lg if no width class is provided in className
    const hasWidthClass = className.match(/\b(max-w-|w-)/);
    const defaultWidth = hasWidthClass ? '' : 'max-w-lg';
    
    return (
        <div className={`relative bg-white rounded-2xl shadow-2xl p-4 sm:p-6 ${defaultWidth} ${hasWidthClass ? '' : 'w-full'} border border-gray-100 ${className}`}>
            {children}
        </div>
    );
};

export const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div className="mb-4">{children}</div>;
};

export const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <h2 className="text-xl font-semibold text-gray-900 text-center hidden sm:block">{children}</h2>;
};

export const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <p className="text-sm text-gray-500 mt-2 text-center leading-relaxed">{children}</p>;
};

export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">{children}</div>;
};

export const DialogClose: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
        >
            <X className="h-4 w-4" />
        </Button>
    );
};

