/**
 * Reusable Stat Card Component
 * Displays a statistic with icon and optional trend
 */

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
    iconColor = 'text-blue-600',
    bgColor = 'bg-blue-50',
    trend,
    description,
}: StatCardProps) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">{title}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
                        {description && (
                            <p className="mt-1 text-xs text-gray-500">{description}</p>
                        )}
                        {trend && (
                            <p
                                className={`mt-1 text-xs ${
                                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                                }`}
                            >
                                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </p>
                        )}
                    </div>
                    <div className={`rounded-full p-3 ${bgColor}`}>
                        <Icon className={`h-6 w-6 ${iconColor}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
