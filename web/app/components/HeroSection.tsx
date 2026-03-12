"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllCategories, type Category } from "@/lib/api/categories";
import { useRouter as useNextRouter } from "next/navigation";

export default function HeroSection() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [categories, setCategories] = useState<Array<{ name: string; href: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [searchSuggestions, setSearchSuggestions] = useState<Category[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchTopCategories() {
            try {
                setLoading(true);
                const fetchedCategories = await getAllCategories();
                setAllCategories(fetchedCategories);
                
                // Sort by priority (ascending - lower number = higher priority)
                // Then take top 3
                const sortedCategories = fetchedCategories
                    .filter(cat => cat.isActive)
                    .sort((a, b) => {
                        const priorityA = a.priority ?? 0;
                        const priorityB = b.priority ?? 0;
                        if (priorityA !== priorityB) {
                            return priorityA - priorityB;
                        }
                        // If priorities are equal, sort by name
                        return a.name.localeCompare(b.name);
                    })
                    .slice(0, 3)
                    .map(cat => ({
                        name: cat.name,
                        href: `/services/${cat.slug}`,
                    }));
                
                setCategories(sortedCategories);
            } catch (err) {
                console.error('Failed to fetch categories:', err);
                // Fallback to empty array or default categories
                setCategories([]);
            } finally {
                setLoading(false);
            }
        }

        fetchTopCategories();
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
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // If there's a matching suggestion, go to the first one
            if (searchSuggestions.length > 0 && searchSuggestions[0]) {
                handleSuggestionClick(searchSuggestions[0]);
            } else {
                // Otherwise, go to services page to show all services
                router.push('/services');
                setSearchQuery('');
                setShowSuggestions(false);
            }
        }
    };

    const handleSuggestionClick = (category: Category) => {
        // Navigate immediately
        router.push(`/services/${category.slug}`);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchSuggestions.length > 0 && searchSuggestions[0]) {
            e.preventDefault();
            handleSuggestionClick(searchSuggestions[0]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <section className="h-[450px] md:h-[500px] bg-white w-full py-3 md:py-6 flex items-center justify-center overflow-hidden">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-full">
                {/* Background Image Overlay */}
                <div className="relative w-full h-full rounded-xl md:rounded-2xl flex items-center justify-center">
                    <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-[url('/images/hero-image.png')] bg-cover bg-center opacity-90"></div>
                    <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-b from-black/50 to-black/40"></div>
                    {/* Content */}
                    <div className="relative z-10 max-w-4xl mx-auto px-4 py-4 md:px-6 text-center w-full">
                        {/* Main Title */}
                        <h1 className="text-2xl md:text-4xl lg:text-5xl font-hkgb text-white mb-4 md:mb-6 tracking-tight leading-tight">
                            Print Your Vision.<br className="hidden md:block" /> Quality Printing Services.
                        </h1>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="mb-6 md:mb-6">
                            <div ref={searchRef} className="relative max-w-2xl mx-auto">
                                <div className="relative flex items-center bg-white rounded-full shadow-lg">
                                    <div className="absolute left-4 md:left-6">
                                        <svg
                                            width="18"
                                            height="18"
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
                                        placeholder="Search services..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                                        onKeyDown={handleKeyDown}
                                        className="flex-1 pl-10 md:pl-12 pr-12 md:pr-14 py-2.5 md:py-3 rounded-full outline-none text-gray-900 placeholder:text-gray-400 text-sm md:text-base"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-1.5 md:right-2 w-10 h-10 bg-[#008ECC] rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                                        aria-label="Search"
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="text-white"
                                        >
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                            <polyline points="12 5 19 12 12 19"></polyline>
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Search Suggestions Dropdown */}
                                {showSuggestions && searchSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-64 overflow-y-auto z-50">
                                        {searchSuggestions.map((category) => (
                                            <Link
                                                key={category.id}
                                                href={`/services/${category.slug}`}
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    setShowSuggestions(false);
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
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </form>

                        {/* Category Buttons */}
                        {loading ? (
                            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="px-4 md:px-6 py-2 md:py-2.5 bg-gray-200 rounded-full animate-pulse h-9 md:h-10 w-24 md:w-32"
                                    />
                                ))}
                            </div>
                        ) : categories.length > 0 ? (
                            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                                {categories.map((category) => (
                                    <Link
                                        key={category.name}
                                        href={category.href}
                                        className="px-4 md:px-6 py-2 md:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-medium transition-colors text-sm md:text-base"
                                    >
                                        {category.name}
                                    </Link>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
}
