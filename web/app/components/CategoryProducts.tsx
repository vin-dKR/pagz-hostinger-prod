"use client";
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useCategories } from '@/lib/hooks/use-categories';
import { type Category } from '@/lib/api/categories';

// Color gradients for category cards (cycling through these)
const colorGradients = [
    "from-blue-900/90 to-blue-700/90",
    "from-purple-900/90 to-purple-700/90",
    "from-amber-900/90 to-amber-700/90",
    "from-emerald-900/90 to-emerald-700/90",
    "from-red-900/90 to-red-700/90",
    "from-indigo-900/90 to-indigo-700/90",
    "from-pink-900/90 to-pink-700/90",
    "from-teal-900/90 to-teal-700/90",
];

export default function CategoryProducts() {
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);
    // Use TanStack Query hook for caching - reduces AWS bandwidth costs
    const { data: categories = [], isLoading: loading, error } = useCategories();

    // Map category to product format
    const getCategoryImage = (category: Category): string => {
        // Use primary image if available
        if (category.images && category.images.length > 0 && category.images[0]) {
            return category.images[0].url;
        }
        // Fallback to legacy image field
        if (category.image) {
            return category.image;
        }
        // Default placeholder
        return "/images/rows/row1.png";
    };

    const getCategoryColor = (index: number): string => {
        const gradientIndex = index % colorGradients.length;
        const gradient = colorGradients[gradientIndex];
        return gradient ?? colorGradients[0] ?? "from-blue-900/90 to-blue-700/90";
    };

    const getCategoryAction = (categoryName: string): string => {
        // Generate action text from category name
        if (categoryName.toLowerCase().includes('print')) {
            return 'Print Now';
        }
        if (categoryName.toLowerCase().includes('book')) {
            return 'Print Books';
        }
        if (categoryName.toLowerCase().includes('photo')) {
            return 'Print Photos';
        }
        if (categoryName.toLowerCase().includes('map')) {
            return 'Print Maps';
        }
        return 'View Service';
    };

    if (loading) {
        return (
            <section className="py-4 md:py-8 bg-white">
                <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full place-items-center justify-center">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="relative aspect-square w-[167px] md:w-[253px] rounded-lg md:rounded-2xl overflow-hidden bg-gray-200 animate-pulse"
                            />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (error || categories.length === 0) {
        return (
            <section className="py-10 bg-white">
                <div className="w-full mx-auto px-10">
                    <div className="text-center text-gray-500">
                        <p>{error?.message || 'No categories available'}</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-4 md:py-8 bg-white">
            <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-3 md:mb-5">
                    <h2 className="text-lg md:text-2xl font-bold text-gray-900">Our Services</h2>
                    <Link
                        href="/services"
                        className="hidden md:flex text-blue-600 hover:text-blue-700 font-medium items-center gap-2 transition-colors text-sm md:text-base"
                    >
                        See All
                        <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                    </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full place-items-center justify-center">
                    {categories.map((category, index) => {
                        const imageUrl = getCategoryImage(category);
                        const color = getCategoryColor(index);
                        const action = getCategoryAction(category.name);

                        return (
                            <div key={category.id} className="flex flex-col w-[167px] md:w-[253px]">
                                <Link
                                    href={`/services/${category.slug}`}
                                    className="relative group aspect-square w-full rounded-2xl md:rounded-2xl overflow-hidden cursor-pointer"
                                    onMouseEnter={() => setHoveredCard(category.id)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                >
                                    {/* Background Image with Zoom */}
                                    <div className="absolute inset-0">
                                        <div
                                            className={`w-full h-full bg-cover bg-center transition-transform duration-700 ${hoveredCard === category.id ? 'scale-110' : 'scale-100'
                                                }`}
                                            style={{ backgroundImage: `url(${imageUrl})` }}
                                        />
                                    </div>

                                    {/* Title Overlay - Desktop only (hidden on mobile) */}
                                    <div className="hidden md:block absolute bottom-0 left-0 right-0 p-2 md:p-4 lg:p-6 bg-linear-to-t from-black/80 to-transparent">
                                        <h3 className="text-xs md:text-lg lg:text-xl font-bold text-white">
                                            {category.name}
                                        </h3>
                                    </div>

                                    {/* Hover Overlay - Desktop only (slides up from bottom) */}
                                    <div
                                        className={`hidden md:block absolute inset-x-0 bottom-0 top-auto h-full bg-linear-to-t ${color} transition-all duration-500 ${hoveredCard === category.id
                                            ? 'translate-y-0 opacity-100'
                                            : 'translate-y-full opacity-0'
                                            }`}
                                    >
                                        <div className="h-full flex flex-col justify-center items-center p-2 md:p-5 lg:p-6">
                                            {/* Description */}
                                            <p className="text-white text-center mb-2 md:mb-5 lg:mb-6 leading-relaxed text-xs md:text-base lg:text-base">
                                                {category.description || `${category.name} services with professional quality and fast delivery.`}
                                            </p>

                                            {/* CTA Button */}
                                            <button className="bg-white text-gray-900 py-1.5 md:py-2.5 lg:py-3 px-3 md:px-5 lg:px-6 rounded-lg font-bold hover:bg-gray-100 flex items-center gap-2 transform hover:scale-105 transition-all text-xs md:text-base lg:text-base">
                                                {action}
                                                <ArrowRight className="w-3 h-3 md:w-4 md:h-4 lg:w-5 lg:h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </Link>
                                
                                {/* Category Name - Mobile only (below image) */}
                                <Link
                                    href={`/services/${category.slug}`}
                                    className="md:hidden mt-2"
                                >
                                    <h3 className="text-xs font-bold text-gray-900 text-center">
                                        {category.name}
                                    </h3>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
