/**
 * Category Bar Component
 * Displays category navigation with smooth scroll-based visibility
 * Optimized to prevent flickering during slow scrolls
 */
 
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface CategoryBarProps {
    isVisible: boolean;
    categories: Array<{ name: string; slug: string }>;
    activeCategory: string | null;
    onCategoryChange: (category: string) => void;
    isLoading?: boolean;
}

export function CategoryBar({
    isVisible,
    categories,
    activeCategory,
    onCategoryChange,
    isLoading: externalLoading,
}: CategoryBarProps) {
    const pathname = usePathname();
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
    const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // Use external loading state if provided, otherwise use internal
    const isLoading = externalLoading !== undefined ? externalLoading : false;

    // Fallback categories if API fails
    const fallbackCategories = [
        'All',
        'Print',
        'Book',
        'Photo',
        'Business Card',
        'Letter Head',
        'BILL BOOK',
        'PAMPLTE',
        'MAP',
    ];

    const displayCategoriesAndSlugs =
        categories.length > 0
            ? categories.map((cat) => ({ name: cat.name, slug: cat.slug }))
            : fallbackCategories.map((name) => ({
                  name,
                  slug: name.toLowerCase().replace(/\s+/g, '-'),
              }));

    // Don't show on auth pages
    if (pathname?.startsWith('/auth')) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className="bg-white border-b border-gray-100"
            style={{
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
                opacity: isVisible ? 1 : 0,
                maxHeight: isVisible ? '200px' : '0px',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform, opacity, max-height',
                pointerEvents: isVisible ? 'auto' : 'none',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 40,
            }}
        >
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
                <div className="flex xl:justify-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-2">
                    <div className="flex items-center gap-2 lg:gap-4 min-w-3xl">
                        {isLoading ? (
                            <div className="flex items-center gap-2 lg:gap-4">
                                {/* Skeleton loaders for categories */}
                                {[...Array(8)].map((_, index) => (
                                    <div
                                        key={index}
                                        className="animate-pulse h-8 w-20 lg:w-24 bg-gray-200 rounded-xl"
                                    />
                                ))}
                            </div>
                        ) : (
                            displayCategoriesAndSlugs.map(({ name, slug }) => {
                                const isActive = activeCategory === name;
                                const isHovered = hoveredCategory === name;
                                const categorySlug = slug;

                                return (
                                    <div
                                        key={slug}
                                        ref={(el) => {
                                            categoryRefs.current[slug] = el;
                                        }}
                                        className={`relative flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                                            isActive
                                                ? 'bg-[#008ECC] text-white'
                                                : isHovered
                                                  ? 'bg-[#008ECC]/80 text-white'
                                                  : 'bg-[#F3F9FB] text-black hover:bg-[#008ECC]/10'
                                        }`}
                                        onMouseEnter={() => setHoveredCategory(name)}
                                        onMouseLeave={() => setHoveredCategory(null)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={
                                                    categorySlug
                                                        ? `/services/${categorySlug}`
                                                        : '/services'
                                                }
                                                onClick={() => onCategoryChange(name)}
                                                className="text-xs lg:text-sm"
                                            >
                                                {name}
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
