'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { type Category, type CategorySearchResult } from '@/lib/api/categories.service';
import { useCategorySearch } from '@/lib/hooks/use-category-search';
import { Loader2, Search, X } from 'lucide-react';

interface ChildCategoriesSelectorProps {
    value: string[];
    onChange: (next: string[]) => void;
    excludeCategoryIds?: string[];
    allCategories: Category[];
    label?: string;
    placeholder?: string;
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

export function ChildCategoriesSelector({
    value,
    onChange,
    excludeCategoryIds = [],
    allCategories,
    label = 'Child Categories',
    placeholder = 'Search for child categories...',
}: ChildCategoriesSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const excludeSet = useMemo(() => new Set(excludeCategoryIds), [excludeCategoryIds]);
    const selectedSet = useMemo(() => new Set(value), [value]);
    const categoriesById = useMemo(() => new Map(allCategories.map((c) => [c.id, c])), [allCategories]);

    const debouncedQuery = useDebounce(searchQuery, 300);

    // Note: searchCategories already supports excluding a single id; we also filter out more ids client-side.
    const searchQueryResult = useCategorySearch(debouncedQuery, {
        excludeId: excludeCategoryIds[0],
        limit: 10,
        enabled: showDropdown,
    });

    const searchResults: CategorySearchResult[] = searchQueryResult.data ?? [];

    const addSelected = useCallback(
        (category: CategorySearchResult) => {
            if (selectedSet.has(category.id)) return;
            onChange([...value, category.id]);
            setSearchQuery('');
            setShowDropdown(false);
        },
        [onChange, selectedSet, value]
    );

    const removeSelected = useCallback(
        (categoryId: string) => {
            onChange(value.filter((id) => id !== categoryId));
        },
        [onChange, value]
    );

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    return (
        <div className="space-y-2" ref={containerRef}>
            <Label htmlFor="child-category">{label}</Label>

            <div className="space-y-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        id="child-category"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.trim().length > 0) setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(searchQuery.trim().length > 0)}
                        placeholder={placeholder}
                        className="pl-10 pr-10"
                    />

                    {searchQuery.trim().length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setShowDropdown(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Clear selection"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    {showDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {searchQueryResult.isFetching ? (
                                <div className="p-4 text-center text-gray-500">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                    <p className="text-sm">Searching...</p>
                                </div>
                            ) : (
                                (() => {
                                    const availableResults = searchResults
                                        .filter((r) => !excludeSet.has(r.id))
                                        .filter((r) => !selectedSet.has(r.id));

                                    if (availableResults.length === 0) {
                                        return (
                                            <div className="p-4 text-center text-gray-500">
                                                <p className="text-sm">No child categories found</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="p-2">
                                            {availableResults.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => addSelected(cat)}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-gray-100"
                                                >
                                                    <div className="font-medium">{cat.name}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{cat.slug}</div>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    )}
                </div>
            </div>

            {value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {value.map((childId) => {
                        const cat = categoriesById.get(childId);
                        return (
                            <div
                                key={childId}
                                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1"
                            >
                                <div className="text-xs text-blue-900 font-medium">
                                    {cat?.name ?? childId}
                                </div>
                                {cat?.slug && <div className="text-[10px] text-gray-500">({cat.slug})</div>}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSelected(childId)}
                                    className="h-6 w-6"
                                    aria-label={`Remove ${cat?.name ?? childId}`}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

