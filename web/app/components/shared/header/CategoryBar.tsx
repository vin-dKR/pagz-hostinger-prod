/**
 * Category Bar Component
 * Displays category navigation with dropdown menus
 * Vercel-style smooth animations
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// import { ChevronDown } from 'lucide-react';
import { useCategories } from '@/lib/hooks/use-categories';

interface CategoryBarProps {
    isVisible: boolean;
    categories: Array<{ name: string; slug: string }>;
    activeCategory: string | null;
    onCategoryChange: (category: string) => void;
    isLoading?: boolean;
}

export function CategoryBar({ isVisible,categories, activeCategory, onCategoryChange, isLoading: externalLoading }: CategoryBarProps) {
    const pathname = usePathname();
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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


    const displayCategoriesAndSlugs = categories.length > 0
        ? categories.map((cat) => ({ name: cat.name, slug: cat.slug }))
        : fallbackCategories.map((name) => ({ name, slug: name.toLowerCase().replace(/\s+/g, '-') }));

    // Calculate dropdown position when hovering
    useEffect(() => {
        if (hoveredCategory && categoryRefs.current[hoveredCategory]) {
            const element = categoryRefs.current[hoveredCategory];
            if (element) {
                const rect = element.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + window.scrollY + 8,
                    left: rect.left + window.scrollX,
                });
            }
        } else {
            setDropdownPosition(null);
        }
    }, [hoveredCategory]);

    // Don't show on auth pages
    if (pathname?.startsWith('/auth')) {
        return null;
    }

    return (
        <>
            {/* Category Bar - Takes no space when hidden */}
            <div
                className={`bg-white border-b border-gray-100 transition-all duration-300 ease-in-out ${isVisible
                    ? 'translate-y-0 opacity-100'
                    : '-translate-y-full opacity-0'
                    }`}
                style={{
                    pointerEvents: isVisible ? 'auto' : 'none',
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
                                            className={`relative flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${isActive
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
                                                    href={categorySlug ? `/products?category=${categorySlug}` : '/products'}
                                                    onClick={() => onCategoryChange(name)}
                                                    className="text-xs lg:text-sm"
                                                >
                                                    {name}
                                                </Link>

                                                {/* FUTURE IMPLEMENTATION */}
                                                {/* <ChevronDown
                                                    size={16}
                                                    className={`transition-transform duration-200 shrink-0 ${isHovered ? 'rotate-180' : ''
                                                        }`}
                                                /> */}
                                            </div>

                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* FUTURE IMPLEMENTATION OF DROPDOWN MENU   */}
            {/* Dropdown Menu - Fixed positioning when visible, appears below header */}
            {/* {hoveredCategory && dropdownPosition && (
                <div
                    className="fixed bg-white border border-gray-200 rounded-lg shadow-2xl min-w-[180px] py-2 z-[9999]"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                    }}
                    onMouseEnter={() => setHoveredCategory(hoveredCategory)}
                    onMouseLeave={() => setHoveredCategory(null)}
                >
                    <Link
                        href={`/products?category=${hoveredCategory.toLowerCase().replace(/\s+/g, '-')}`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                            onCategoryChange(hoveredCategory);
                            setHoveredCategory(null);
                        }}
                    >
                        All {hoveredCategory}
                    </Link>
                    <Link
                        href={`/products?category=${hoveredCategory.toLowerCase().replace(/\s+/g, '-')}&subcategory=featured`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                            onCategoryChange(hoveredCategory);
                            setHoveredCategory(null);
                        }}
                    >
                        Featured Items
                    </Link>
                    <Link
                        href={`/products?category=${hoveredCategory.toLowerCase().replace(/\s+/g, '-')}&subcategory=new`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                            onCategoryChange(hoveredCategory);
                            setHoveredCategory(null);
                        }}
                    >
                        New Arrivals
                    </Link>
                    <Link
                        href={`/products?category=${hoveredCategory.toLowerCase().replace(/\s+/g, '-')}&subcategory=on-sale`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                            onCategoryChange(hoveredCategory);
                            setHoveredCategory(null);
                        }}
                    >
                        On Sale
                    </Link>
                </div>
            )} */}
        </>
    );
}
