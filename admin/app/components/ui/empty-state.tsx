/**
 * Reusable Empty State Component
 */

import { Button } from './button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: {
        label: string;
        onClick?: () => void;
        href?: string;
    };
}

export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center px-4 py-14 text-center">
            {Icon && (
                <div className="mb-4 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)]">
                        <Icon className="h-5 w-5 text-[var(--color-foreground-tertiary)]" />
                    </div>
                </div>
            )}
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
            {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--color-foreground-secondary)]">{description}</p>}
            {action && (
                <div className="mt-5">
                    {action.href ? (
                        <a href={action.href}>
                            <Button>{action.label}</Button>
                        </a>
                    ) : action.onClick ? (
                        <Button onClick={action.onClick}>{action.label}</Button>
                    ) : null}
                </div>
            )}
        </div>
    );
}
