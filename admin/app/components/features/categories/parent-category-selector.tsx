'use client';

/**
 * Parent Category Selector Component
 * Reusable component for selecting a parent category with search functionality.
 * Backed by TanStack Query for caching/deduping.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { type CategorySearchResult } from '@/lib/api/categories.service';
import { useCategoryById, useCategorySearch } from '@/lib/hooks/use-category-search';
import { Search, X, Loader2 } from 'lucide-react';

interface ParentCategorySelectorProps {
    value?: string | null;
    onChange: (parentId: string | null) => void;
    excludeCategoryId?: string;
    label?: string;
    placeholder?: string;
}

/**
 * Debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export function ParentCategorySelector({
    value,
    onChange,
    excludeCategoryId,
    label = 'Parent Category',
    placeholder = 'Search for a parent category...',
}: ParentCategorySelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CategorySearchResult | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const debouncedQuery = useDebounce(searchQuery, 300);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedCategoryQuery = useCategoryById(value ?? null, true);
    const searchQueryResult = useCategorySearch(debouncedQuery, {
        excludeId: excludeCategoryId,
        limit: 10,
        enabled: showDropdown,
    });
    const searchResults: CategorySearchResult[] = searchQueryResult.data ?? [];

    // Sync selected category display from query result
    useEffect(() => {
        if (!value) {
            setSelectedCategory(null);
            setSearchQuery('');
            return;
        }

        const cat = selectedCategoryQuery.data;
        if (cat) {
            const mapped: CategorySearchResult = {
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
                parentId: cat.parentId || null,
            };
            setSelectedCategory(mapped);
            setSearchQuery(cat.name);
        }
    }, [value, selectedCategoryQuery.data]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = useCallback((category: CategorySearchResult) => {
        setSelectedCategory(category);
        setSearchQuery(category.name);
        onChange(category.id);
        setShowDropdown(false);
    }, [onChange]);

    const handleClear = useCallback(() => {
        setSelectedCategory(null);
        setSearchQuery('');
        onChange(null);
        setShowDropdown(false);
    }, [onChange]);

    const handleInputFocus = useCallback(() => {
        if (searchQuery.trim().length > 0 || searchResults.length > 0) {
            setShowDropdown(true);
        }
    }, [searchQuery, searchResults.length]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.trim().length > 0) {
            setShowDropdown(true);
        } else {
            setShowDropdown(false);
        }
    }, []);

    return (
        <div className="space-y-2" ref={containerRef}>
            <Label htmlFor="parent-category">{label}</Label>
            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        id="parent-category"
                        type="text"
                        value={searchQuery}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        placeholder={placeholder}
                        className="pl-10 pr-10"
                    />
                    {selectedCategory && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Clear selection"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Dropdown */}
                {showDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {searchQueryResult.isFetching ? (
                            <div className="p-4 text-center text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                <p className="text-sm">Searching...</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <>
                                <div className="p-2">
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                    >
                                        <span className="font-medium">No parent (Standalone category)</span>
                                    </button>
                                </div>
                                <div className="border-t border-gray-200" />
                                <div className="p-2">
                                    {searchResults.map((category) => (
                                        <button
                                            key={category.id}
                                            type="button"
                                            onClick={() => handleSelect(category)}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                                selectedCategory?.id === category.id
                                                    ? 'bg-blue-50 text-blue-900 font-medium'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <div className="font-medium">{category.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{category.slug}</div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : debouncedQuery.trim().length > 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                <p className="text-sm">No categories found</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Selected category display */}
            {selectedCategory && !showDropdown && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-900">{selectedCategory.name}</p>
                            <p className="text-xs text-blue-700 mt-0.5">{selectedCategory.slug}</p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            className="text-blue-700 hover:text-blue-900"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
