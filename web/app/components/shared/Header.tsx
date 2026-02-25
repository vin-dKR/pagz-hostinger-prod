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
    const [isCategoryVisible, setIsCategoryVisible] = useState(true);
    const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
    const previousVisibility = useRef(true);
    const lastStateChangeTime = useRef(0);
    const scrollAccumulator = useRef(0); // Accumulate scroll distance over time

    const headerRef = useRef<HTMLElement>(null);
    const { data: categories = [], isLoading: categoriesLoading } = useCategories();

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
        { id :"1", name: 'All', slug: '' },
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

    // Sync previousVisibility ref with state changes
    useEffect(() => {
        previousVisibility.current = isCategoryVisible;
    }, [isCategoryVisible]);

    // Hide/show category bar on scroll with smooth, flicker-free behavior
    useEffect(() => {
        const SHOW_THRESHOLD = 50; // Show when scrolled back to top
        const HIDE_THRESHOLD = 100; // Hide when scrolled past this point
        const MIN_SCROLL_DELTA = 15; // Minimum scroll delta to trigger change (px)
        const COOLDOWN_MS = 300; // Minimum time between state changes (ms)

        const controlHeader = () => {
            const currentScrollY = window.scrollY;
            const scrollDelta = currentScrollY - lastScrollY.current;
            const wasVisible = previousVisibility.current;
            const now = Date.now();
            const timeSinceLastChange = now - lastStateChangeTime.current;

            // Cooldown: prevent rapid state changes
            if (timeSinceLastChange < COOLDOWN_MS) {
                lastScrollY.current = currentScrollY;
                return;
            }

            // Show at the top of the page
            if (currentScrollY <= SHOW_THRESHOLD) {
                if (!wasVisible) {
                    setIsCategoryVisible(true);
                    previousVisibility.current = true;
                    lastStateChangeTime.current = now;
                    lastScrollY.current = currentScrollY;
                    scrollAccumulator.current = 0;
                }
                lastScrollY.current = currentScrollY;
                return;
            }

            // Accumulate scroll distance
            if (Math.abs(scrollDelta) >= 2) {
                // Reset accumulator if scroll direction changed (opposite signs)
                if ((scrollDelta > 0 && scrollAccumulator.current < 0) || 
                    (scrollDelta < 0 && scrollAccumulator.current > 0)) {
                    scrollAccumulator.current = 0;
                }
                
                // Add to accumulator
                scrollAccumulator.current += scrollDelta;
            }

            // Check if we have enough accumulated scroll in one direction
            const hasSignificantScroll = Math.abs(scrollAccumulator.current) >= MIN_SCROLL_DELTA;
            const isScrollingDown = scrollAccumulator.current > 0;
            const isScrollingUp = scrollAccumulator.current < 0;

            if (hasSignificantScroll) {
                if (isScrollingDown && currentScrollY > HIDE_THRESHOLD && wasVisible) {
                    // Scrolling down past hide threshold - hide
                    setIsCategoryVisible(false);
                    previousVisibility.current = false;
                    lastStateChangeTime.current = now;
                    scrollAccumulator.current = 0;
                } else if (isScrollingUp && !wasVisible) {
                    // Scrolling up - show
                    setIsCategoryVisible(true);
                    previousVisibility.current = true;
                    lastStateChangeTime.current = now;
                    scrollAccumulator.current = 0;
                }
            }

            lastScrollY.current = currentScrollY;
        };

        // Throttle scroll events using requestAnimationFrame
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    controlHeader();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className="sticky top-0 z-50 bg-white" ref={headerRef}>
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

            {/* Category Bar */}
            <CategoryBar
                isVisible={isCategoryVisible}
                categories={allCategories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                isLoading={categoriesLoading}
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
