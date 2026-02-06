/**
 * Alert Components
 * Reusable alert/notification components
 */

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
    onClose?: () => void;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant = 'default', onClose, children, ...props }, ref) => {
        const variants = {
            default: 'bg-[var(--color-background-secondary)] border-[var(--color-border)] text-[var(--color-foreground)]',
            success: 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]',
            error: 'bg-[var(--color-destructive)]/10 border-[var(--color-destructive)]/30 text-[var(--color-destructive)]',
            warning: 'bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30 text-[var(--color-warning)]',
            info: 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]',
        };

        const icons = {
            default: null,
            success: <CheckCircle2 className="h-4 w-4" />,
            error: <AlertCircle className="h-4 w-4" />,
            warning: <AlertCircle className="h-4 w-4" />,
            info: <Info className="h-4 w-4" />,
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'relative w-full rounded-[var(--radius-lg)] border p-4 transition-all duration-200',
                    variants[variant],
                    className
                )}
                {...props}
            >
                <div className="flex items-start gap-3">
                    {icons[variant] && <div className="mt-0.5 flex-shrink-0">{icons[variant]}</div>}
                    <div className="flex-1 text-sm leading-relaxed">{children}</div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="ml-auto rounded-[var(--radius-sm)] opacity-70 hover:opacity-100 transition-opacity p-1"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        );
    }
);
Alert.displayName = 'Alert';

export { Alert };

