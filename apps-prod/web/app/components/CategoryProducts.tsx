"use client";
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAllCategories, type Category } from '@/lib/api/categories';

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
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCategories() {
            try {
                setLoading(true);
                setError(null);
                const data = await getAllCategories();
                // Take first 8 categories for the main display (show 4 on mobile, 8 on desktop)
                setCategories(data.slice(0, 8));
            } catch (err: any) {
                console.log("----", err)
                console.error('Failed to fetch categories:', err);
                setError(err.message || 'Failed to load categories');
            } finally {
                setLoading(false);
            }
        }

        fetchCategories();
    }, []);

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
            <section className="py-6 md:py-8 bg-white">
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-3 md:gap-4 lg:gap-5 2xl:gap-6 w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className={`relative aspect-square md:aspect-4/3 lg:aspect-square w-full min-w-0 rounded-2xl md:rounded-3xl lg:rounded-4xl overflow-hidden bg-gray-200 animate-pulse ${i > 4 ? 'hidden 2xl:block' : ''} ${i > 3 && i <= 6 ? 'hidden md:block 2xl:block' : ''}`} />
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
                        <p>{error || 'No categories available'}</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-6 md:py-8 bg-white">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-4 md:mb-5">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Our Services</h2>
                    <Link
                        href="/services"
                        className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 transition-colors text-sm md:text-base"
                    >
                        See All
                        <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-3 md:gap-4 lg:gap-5 2xl:gap-6 w-full">
                    {categories.map((category, index) => {
                        const imageUrl = getCategoryImage(category);
                        const color = getCategoryColor(index);
                        const action = getCategoryAction(category.name);
                        // Hide items 5-8 on smaller screens, show items 5-6 on medium screens (tablets), show all 8 on 2xl screens (>= 1536px, close to 1690px)
                        const isMobileHidden = index >= 4;
                        const isLargeOnly = index >= 6;

                        return (
                            <Link
                                href={`/services/${category.slug}`}
                                key={category.id}
                                className={`relative group aspect-square md:aspect-4/3 lg:aspect-square w-full min-w-0 rounded-2xl md:rounded-3xl lg:rounded-4xl overflow-hidden cursor-pointer ${isMobileHidden
                                    ? isLargeOnly
                                        ? 'hidden 2xl:block'
                                        : 'hidden md:block'
                                    : ''
                                    }`}
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

                                {/* Title Overlay - Always at bottom */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 lg:p-6 bg-linear-to-t from-black/80 to-transparent">
                                    <h3 className="text-base md:text-lg lg:text-xl font-bold text-white">
                                        {category.name}
                                    </h3>
                                </div>

                                {/* Hover Overlay - Slides up from bottom */}
                                <div
                                    className={`absolute inset-x-0 bottom-0 top-auto h-full bg-linear-to-t ${color} transition-all duration-500 ${hoveredCard === category.id
                                        ? 'translate-y-0 opacity-100'
                                        : 'translate-y-full opacity-0'
                                        }`}
                                >
                                    <div className="h-full flex flex-col justify-center items-center p-4 md:p-5 lg:p-6">
                                        {/* Description */}
                                        <p className="text-white text-center mb-4 md:mb-5 lg:mb-6 leading-relaxed text-sm md:text-base lg:text-base">
                                            {category.description || `${category.name} services with professional quality and fast delivery.`}
                                        </p>

                                        {/* CTA Button */}
                                        <button className="bg-white text-gray-900 py-2 md:py-2.5 lg:py-3 px-4 md:px-5 lg:px-6 rounded-lg font-bold hover:bg-gray-100 flex items-center gap-2 transform hover:scale-105 transition-all text-sm md:text-base lg:text-base">
                                            {action}
                                            <ArrowRight className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
