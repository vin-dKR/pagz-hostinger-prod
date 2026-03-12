/**
 * Search Bar Component
 * Handles service/category search functionality with recommendations
 */

'use client';

import { FormEvent, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { getAllCategories, type Category } from '@/lib/api/categories';

interface SearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isMobile?: boolean;
    onClose?: () => void;
}

export function SearchBar({ searchQuery, setSearchQuery, isMobile = false, onClose }: SearchBarProps) {
    const router = useRouter();
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [searchSuggestions, setSearchSuggestions] = useState<Category[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Fetch all categories
    useEffect(() => {
        async function fetchCategories() {
            try {
                const categories = await getAllCategories();
                setAllCategories(categories);
            } catch (err) {
                console.error('Failed to fetch categories:', err);
            }
        }
        fetchCategories();
    }, []);

    // Handle search suggestions
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const query = searchQuery.toLowerCase().trim();
            const filtered = allCategories
                .filter(cat => 
                    cat.isActive && (
                        cat.name.toLowerCase().includes(query) ||
                        cat.slug.toLowerCase().includes(query) ||
                        (cat.description && cat.description.toLowerCase().includes(query))
                    )
                )
                .slice(0, 5); // Show top 5 suggestions
            setSearchSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSearchSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchQuery, allCategories]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // Don't close if clicking on a suggestion button
            if (target.closest('button[type="button"]') && target.closest('.z-50')) {
                console.log('🔍 SearchBar - Click on suggestion button detected, not closing');
                return;
            }
            // Add delay to allow button click to process first
            setTimeout(() => {
                if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                    console.log('🔍 SearchBar - Click outside detected, closing suggestions');
                    setShowSuggestions(false);
                }
            }, 200);
        };

        // Use click event with capture phase disabled to avoid interfering
        document.addEventListener('click', handleClickOutside, false);
        return () => {
            document.removeEventListener('click', handleClickOutside, false);
        };
    }, []);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            console.log('🔍 SearchBar - Form submitted:', {
                searchQuery: searchQuery.trim(),
                suggestionsCount: searchSuggestions.length,
                firstSuggestion: searchSuggestions[0] ? {
                    id: searchSuggestions[0].id,
                    name: searchSuggestions[0].name,
                    slug: searchSuggestions[0].slug
                } : null
            });
            if (onClose) onClose();
            // If there's a matching suggestion, go to the first one
            if (searchSuggestions.length > 0 && searchSuggestions[0]) {
                console.log('🔍 SearchBar - Navigating to first suggestion:', `/services/${searchSuggestions[0].slug}`);
                router.push(`/services/${searchSuggestions[0].slug}`);
            } else {
                console.log('🔍 SearchBar - No suggestions, navigating to services page');
                // Otherwise, go to services page to show all services
                router.push('/services');
            }
            setSearchQuery('');
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (category: Category) => {
        console.log('🔍 SearchBar - handleSuggestionClick called:', {
            categoryId: category.id,
            categoryName: category.name,
            categorySlug: category.slug,
            targetUrl: `/services/${category.slug}`
        });
        // Close dropdown and clear search first
        setShowSuggestions(false);
        setSearchQuery('');
        if (onClose) onClose();
        
        // Use setTimeout to ensure state updates complete before navigation
        setTimeout(() => {
            console.log('🔍 SearchBar - Navigating to:', `/services/${category.slug}`);
            window.location.href = `/services/${category.slug}`;
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchSuggestions.length > 0 && searchSuggestions[0]) {
            e.preventDefault();
            handleSuggestionClick(searchSuggestions[0]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    }; 

    if (isMobile) {
        return (
            <div className="fixed inset-0 z-[100] bg-white">
                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                        <form className="flex-1 flex gap-2" onSubmit={handleSubmit}>
                            <div ref={searchRef} className="relative flex-1">
                                <div className="relative flex items-center bg-[#F3F9FB] rounded-lg border border-gray-200 px-3 py-2">
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="text-gray-400 mr-2"
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search services..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                                        onKeyDown={handleKeyDown}
                                        className="flex-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                                        autoFocus
                                    />
                                </div>
                                
                                {/* Search Suggestions Dropdown - Mobile */}
                                {showSuggestions && searchSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-64 overflow-y-auto z-50">
                                        {searchSuggestions.map((category) => (
                                            <button
                                                key={category.id}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    // Don't prevent default here - let onClick handle it
                                                    console.log('🔍 SearchBar Mobile - MouseDown event:', {
                                                        categoryId: category.id,
                                                        categoryName: category.name,
                                                        categorySlug: category.slug
                                                    });
                                                }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log('🔍 SearchBar Mobile - onClick event fired:', {
                                                        categoryId: category.id,
                                                        categoryName: category.name,
                                                        categorySlug: category.slug,
                                                        href: `/services/${category.slug}`,
                                                        eventType: e.type,
                                                        timestamp: Date.now()
                                                    });
                                                    handleSuggestionClick(category);
                                                }}
                                                onMouseUp={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log('🔍 SearchBar Mobile - MouseUp event (triggering navigation):', {
                                                        categoryId: category.id,
                                                        categoryName: category.name,
                                                        categorySlug: category.slug,
                                                        timestamp: Date.now()
                                                    });
                                                    handleSuggestionClick(category);
                                                }}
                                                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center gap-3 cursor-pointer"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">{category.name}</div>
                                                    {category.description && (
                                                        <div className="text-sm text-gray-500 mt-1 line-clamp-1">
                                                            {category.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="text-gray-400"
                                                >
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B5] transition-colors font-medium"
                                disabled={!searchQuery.trim()}
                            >
                                Search
                            </button>
                        </form>
                        <button
                            onClick={() => {
                                if (onClose) onClose();
                                setSearchQuery('');
                                setShowSuggestions(false);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Close search"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xl h-full">
            <form
                className="flex-1 relative"
                onSubmit={handleSubmit}
            >
                <div ref={searchRef} className="relative flex-1 flex items-center bg-[#F3F9FB] rounded-xl border border-gray-200 px-3 py-1.5">
                    <div className="pl-1 pr-1.5">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-400"
                        >
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search for services..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 py-1 px-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400 text-sm"
                    />
                </div>
                
                {/* Search Suggestions Dropdown - Desktop */}
                {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-64 overflow-y-auto z-50">
                        {searchSuggestions.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                onMouseDown={(e) => {
                                    console.log('🔍 SearchBar Desktop - MouseDown event:', {
                                        categoryId: category.id,
                                        categoryName: category.name,
                                        categorySlug: category.slug
                                    });
                                }}
                                onMouseUp={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('🔍 SearchBar Desktop - MouseUp event (triggering navigation):', {
                                        categoryId: category.id,
                                        categoryName: category.name,
                                        categorySlug: category.slug,
                                        timestamp: Date.now()
                                    });
                                    handleSuggestionClick(category);
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('🔍 SearchBar Desktop - onClick event fired:', {
                                        categoryId: category.id,
                                        categoryName: category.name,
                                        categorySlug: category.slug,
                                        href: `/services/${category.slug}`,
                                        eventType: e.type,
                                        timestamp: Date.now()
                                    });
                                    handleSuggestionClick(category);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center gap-3 cursor-pointer"
                            >
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900 text-sm">{category.name}</div>
                                    {category.description && (
                                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                                            {category.description}
                                        </div>
                                    )}
                                </div>
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-gray-400"
                                >
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </button>
                        ))}
                    </div>
                )}
            </form>
            <button
                type="submit"
                onClick={handleSubmit}
                className="px-4 py-3 h-full bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B5] transition-colors font-medium text-xs whitespace-nowrap"
                disabled={!searchQuery.trim()}
            >
                Search
            </button>
        </div>
    );
}
