import { Card, CardContent } from './card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    iconColor?: string;
    bgColor?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    description?: string;
}

export function StatCard({
    title,
    value,
    icon: Icon,
    iconColor = 'text-[var(--color-primary)]',
    bgColor = 'bg-[#f3f3f3]',
    trend,
    description,
}: StatCardProps) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[12px] font-medium text-[var(--color-foreground-secondary)]">{title}</p>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${bgColor}`}>
                        <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={1.8} />
                    </div>
                </div>
                <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.04em] text-[var(--color-foreground)] tabular-nums">{value}</p>
                {(description || trend) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {trend && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${trend.isPositive ? 'bg-[#e9f6f0] text-[#217659]' : 'bg-[#fdf0ef] text-[#b83e3e]'}`}>
                                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </span>
                        )}
                        {description && <p className="text-[11px] text-[var(--color-foreground-tertiary)]">{description}</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
