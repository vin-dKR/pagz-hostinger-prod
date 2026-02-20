import React from 'react';
import { Breadcrumb } from '../ui/Breadcrumb';
import { Badge } from '../ui/Badge';
import { Star } from 'lucide-react';
import { BreadcrumbItem } from '@/types';

interface ProductHeaderProps {
    title: string;
    subtitle?: string;
    breadcrumbItems: BreadcrumbItem[];
    rating?: number;
    reviewCount?: number;
    badges?: Array<{ text: string; variant: 'success' | 'warning' | 'error' | 'info' }>;
}

export const ProductHeader: React.FC<ProductHeaderProps> = ({
    title,
    subtitle,
    breadcrumbItems,
    rating = 4.8,
    reviewCount = 2347,
    badges = [],
}) => {
    return (
        <div className="mb-6 sm:mb-8">

            <h1 className="font-hkgb text-2xl sm:text-3xl text-gray-900 mb-3">
                {title}
            </h1>

            {subtitle && (
                <p className="text-gray-600 text-sm sm:text-base mb-4">
                    {subtitle}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
                {rating > 0 && (
                    <div className="flex items-center">
                        <div className="flex">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                />
                            ))}
                        </div>
                        <span className="text-sm text-gray-600 ml-2">
                            {rating.toFixed(1)} ({reviewCount.toLocaleString()} reviews)
                        </span>
                    </div>
                )}

                {badges.map((badge, index) => (
                    <Badge key={index} className="text-xs">
                        {badge.text}
                    </Badge>
                ))}
            </div>
        </div>
    );
};
