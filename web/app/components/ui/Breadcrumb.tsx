import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BreadcrumbItem } from '../../../types';

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
    return (
        <nav className={cn('flex items-center space-x-2 text-sm', className)}>
            {items.map((item, index) => (
                <React.Fragment key={item.href}>
                    <Link
                        href={item.href}
                        className={cn(
                            'transition-colors hover:text-primary',
                            item.isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                        )}
                    >
                        {item.label}
                    </Link>
                    {index < items.length - 1 && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};
