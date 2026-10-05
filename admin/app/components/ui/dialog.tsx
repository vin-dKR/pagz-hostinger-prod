'use client';

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
    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onOpenChange?.(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close dialog"
                className="fixed inset-0 bg-[#242424]/35 backdrop-blur-[3px]"
                onClick={() => onOpenChange?.(false)}
            />
            <div role="dialog" aria-modal="true" className="relative z-50 w-full max-w-4xl animate-[admin-dialog-enter_180ms_ease-out_both]">
                {children}
            </div>
        </div>
    );
};

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
    return (
        <div className={cn(
            'mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-xl)] border border-[#d4d4d4] bg-[linear-gradient(180deg,#f8f8f8,#fff_160px)] p-5 shadow-[0_24px_80px_#00000030,inset_0_0_0_1px_#fff] sm:p-6',
            className
        )}>
            {children}
        </div>
    );
};

export const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div className="mb-5">{children}</div>;
};

export const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-[var(--color-foreground)]">{children}</h2>;
};

export const DialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-foreground-secondary)]">{children}</p>;
};

export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-5">{children}</div>;
};

export const DialogClose: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            className="absolute right-4 top-4 text-[var(--color-foreground-secondary)] hover:text-[var(--color-foreground)]"
            onClick={onClose}
        >
            <X className="h-4 w-4" />
        </Button>
    );
};
