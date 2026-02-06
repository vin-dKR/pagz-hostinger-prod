"use client";

import { useState, useEffect } from "react";
import { getCategories, getProducts, type Category } from "@/lib/api/products";

interface ProductFiltersProps {
    selectedSizes: string[];
    selectedColors: string[]; // Keep for backward compatibility but not used
    selectedPriceRanges: string[];
    selectedCollections: string[];
    selectedTags: string[];
    onSizeChange: (sizes: string[]) => void;
    onColorChange: (colors: string[]) => void; // Keep for backward compatibility but not used
    onPriceRangeChange: (ranges: string[]) => void;
    onCollectionChange: (collections: string[]) => void;
    onTagChange: (tags: string[]) => void;
}

const sizes = ["A4", "A5", "Letter", "Legal", "A3", "A2", "A1", "Custom"];
const priceRanges = [
    "₹0-₹10",
    "₹10-₹20",
    "₹20-₹50",
    "₹50-₹100",
    "₹100-₹200",
    "₹200-₹500",
];
const collections = [
    "All products",
    "Best sellers",
    "New arrivals",
    "Featured",
];

export default function ProductFilters({
    selectedSizes,
    selectedColors,
    selectedPriceRanges,
    selectedCollections,
    selectedTags,
    onSizeChange,
    onColorChange,
    onPriceRangeChange,
    onCollectionChange,
    onTagChange,
}: ProductFiltersProps) {
    const [isCollectionsOpen, setIsCollectionsOpen] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);

    // Fetch categories from API
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoadingCategories(true);
                const response = await getCategories();
                if (response.success && response.data) {
                    setCategories(response.data);
                }
            } catch (err) {
                console.error('Failed to fetch categories:', err);
            } finally {
                setLoadingCategories(false);
            }
        };

        fetchCategories();
    }, []);


    const toggleSize = (size: string) => {
        if (selectedSizes.includes(size)) {
            onSizeChange(selectedSizes.filter((s) => s !== size));
        } else {
            onSizeChange([...selectedSizes, size]);
        }
    };

    const toggleColor = (color: string) => {
        if (selectedColors.includes(color)) {
            onColorChange(selectedColors.filter((c) => c !== color));
        } else {
            onColorChange([...selectedColors, color]);
        }
    };

    const togglePriceRange = (range: string) => {
        if (selectedPriceRanges.includes(range)) {
            onPriceRangeChange(selectedPriceRanges.filter((r) => r !== range));
        } else {
            onPriceRangeChange([...selectedPriceRanges, range]);
        }
    };


    const toggleCollection = (collection: string) => {
        if (selectedCollections.includes(collection)) {
            onCollectionChange(selectedCollections.filter((c) => c !== collection));
        } else {
            onCollectionChange([...selectedCollections, collection]);
        }
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            onTagChange(selectedTags.filter((t) => t !== tag));
        } else {
            onTagChange([...selectedTags, tag]);
        }
    };

    return (
        <div className="w-full lg:w-64 space-y-8">
            <h2 className="text-xl font-bold text-gray-900">Filters</h2>

            {/* Size Filter */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Size</h3>
                <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                        <button
                            key={size}
                            onClick={() => toggleSize(size)}
                            className={`px-4 py-2 rounded-lg border transition-colors ${selectedSizes.includes(size)
                                ? "bg-[#008ECC] text-white border-blue-600"
                                : "bg-white text-gray-700 border-gray-300 hover:border-blue-600"
                                }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Prices Filter */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Prices</h3>
                <div className="space-y-2">
                    {priceRanges.map((range) => (
                        <label
                            key={range}
                            className="flex items-center gap-2 cursor-pointer group"
                        >
                            <input
                                type="checkbox"
                                checked={selectedPriceRanges.includes(range)}
                                onChange={() => togglePriceRange(range)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                {range}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Categories Filter */}
            {categories.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Categories</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {loadingCategories ? (
                            <div className="text-sm text-gray-500">Loading categories...</div>
                        ) : (
                            categories.map((category) => (
                                <label
                                    key={category.id}
                                    className="flex items-center gap-2 cursor-pointer group"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTags.includes(category.name)}
                                        onChange={() => toggleTag(category.name)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                        {category.name}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                </div>
            )}


            {/* Collections Filter */}
            <div>
                <button
                    onClick={() => setIsCollectionsOpen(!isCollectionsOpen)}
                    className="flex items-center justify-between w-full mb-3"
                >
                    <h3 className="text-sm font-semibold text-gray-900">Collections</h3>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transform transition-transform ${isCollectionsOpen ? "rotate-180" : ""
                            }`}
                    >
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                {isCollectionsOpen && (
                    <div className="space-y-2">
                        {collections.map((collection) => (
                            <label
                                key={collection}
                                className="flex items-center gap-2 cursor-pointer group"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCollections.includes(collection)}
                                    onChange={() => toggleCollection(collection)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                    {collection}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
