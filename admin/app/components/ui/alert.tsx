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
            default: 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-foreground)]',
            success: 'bg-[#f0faf5] border-[#d7eee3] text-[#217659]',
            error: 'bg-[#fdf2f1] border-[#f3dddd] text-[#b83e3e]',
            warning: 'bg-[#fff8ed] border-[#f3e5cc] text-[#946018]',
            info: 'bg-[#f5f5fa] border-[#e4e4ec] text-[#64638b]',
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
                    'relative w-full rounded-[var(--radius-lg)] border p-4',
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
                            type="button"
                            aria-label="Dismiss alert"
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
