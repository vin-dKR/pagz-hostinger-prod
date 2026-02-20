/**
 * Header Component
 * Main site header with navigation, search, cart, and user menu
 * Optimized with TanStack Query and broken into reusable components
 */

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { MainNav } from './header/MainNav';
import { CategoryBar } from './header/CategoryBar';
import { MobileMenu } from './header/MobileMenu';
import { useCategories } from '@/lib/hooks/use-categories';

// Component that uses useSearchParams - must be wrapped in Suspense
function SearchParamsSync({
    setSearchQuery,
    setActiveCategory,
    allCategories,
}: {
    setSearchQuery: (query: string) => void;
    setActiveCategory: (category: string | null | 'All') => void;
    allCategories: Array<{ name: string; slug: string }>;
}) {
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Sync category with URL params when on products page
    useEffect(() => {
        if (pathname === '/products') {
            const urlCategorySlug = searchParams.get('category') || '';
            if (urlCategorySlug) {
                // Find matching category from the categories list by comparing actual slug property
                const decodedSlug = decodeURIComponent(urlCategorySlug).toLowerCase();
                const matchedCategory = allCategories.find(cat =>
                    cat.slug.toLowerCase() === decodedSlug
                );

                if (matchedCategory) {
                    // Set active category to the category's name (not slug)
                    setActiveCategory(matchedCategory.name);
                } else {
                    // Fallback: try to reconstruct category name from slug if no match found
                    const decodedCategory = urlCategorySlug
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    setActiveCategory(decodedCategory);
                }
            } else {
                // Clear active category when category param is removed
                setActiveCategory('All');
            }
        } else {
            // Clear active category when not on products page
            setActiveCategory(null);
        }
    }, [searchParams, pathname, setActiveCategory, allCategories]);

    return null;
}

export default function Header() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null | 'All'>(null);
    const { data: categories = [], isLoading: categoriesLoading } = useCategories();

    // Scroll hide/show state for CategoryBar
    const [isCategoryBarVisible, setIsCategoryBarVisible] = useState(true);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);
    const rafId = useRef<number | null>(null);

    // Fallback categories if API fails (with slug property)
    const fallbackCategories = [
        { name: 'Print', slug: 'print' },
        { name: 'Book', slug: 'book' },
        { name: 'Photo', slug: 'photo' },
        { name: 'Business Card', slug: 'business-card' },
        { name: 'Letter Head', slug: 'letter-head' },
        { name: 'BILL BOOK', slug: 'bill-book' },
        { name: 'PAMPLTE', slug: 'pamplate' },
        { name: 'MAP', slug: 'map' },
    ];

    // Add "All" category with empty slug, then append API categories or fallback
    const allCategories = [
        { id: "1", name: 'All', slug: '' },
        ...(categories.length > 0 ? categories : fallbackCategories)
    ];

    // For display in CategoryBar, we still pass names
    const displayCategories = allCategories.map((cat) => cat.name);

    // Reset active category when navigating away from products page
    useEffect(() => {
        if (!pathname?.includes('/products')) {
            setActiveCategory('null');
        }
    }, [pathname]);

    // Optimized scroll handler with requestAnimationFrame
    useEffect(() => {
        const handleScroll = () => {
            if (!ticking.current) {
                rafId.current = requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    const scrollDifference = currentScrollY - lastScrollY.current;

                    // Only update if scroll difference is significant (threshold: 5px)
                    // This prevents excessive state updates on small scrolls
                    if (Math.abs(scrollDifference) > 5) {
                        // Hide when scrolling down, show when scrolling up
                        // Also show when at the top of the page
                        const shouldShow = currentScrollY < 10 || scrollDifference < 0;

                        setIsCategoryBarVisible(shouldShow);
                        lastScrollY.current = currentScrollY;
                    }

                    ticking.current = false;
                });

                ticking.current = true;
            }
        };

        // Initialize last scroll position
        lastScrollY.current = window.scrollY;

        // Use passive listener for better performance
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, []);


    return (
        <header
            className="sticky top-0 z-50 transition-transform duration-300 ease-in-out will-change-transform"
        >
            <Suspense fallback={null}>
                <SearchParamsSync
                    setSearchQuery={setSearchQuery}
                    setActiveCategory={setActiveCategory}
                    allCategories={allCategories}
                />
            </Suspense>

            {/* Main Navigation */}
            <MainNav
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearchOpen={isSearchOpen}
                setIsSearchOpen={setIsSearchOpen}
                onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
            />

            <CategoryBar
                categories={allCategories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                isLoading={categoriesLoading}
                isVisible={isCategoryBarVisible}
            />

            {/* Mobile Menu */}
            <MobileMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                categories={displayCategories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
            />
        </header>
    );
}

