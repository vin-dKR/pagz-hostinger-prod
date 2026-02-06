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
        <div className="py-12 text-center">
            {Icon && (
                <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-gray-100 p-4">
                        <Icon className="h-8 w-8 text-gray-400" />
                    </div>
                </div>
            )}
            <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
            {description && <p className="text-gray-600 mb-4">{description}</p>}
            {action && (
                <div>
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
