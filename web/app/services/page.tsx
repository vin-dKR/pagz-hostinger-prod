'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAllCategories, type Category } from '@/lib/api/categories';
import { ArrowRight, ImageIcon } from 'lucide-react';

export default function ServicesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCategories() {
            try {
                setLoading(true);
                setError(null);
                const data = await getAllCategories();
                setCategories(data);
            } catch (err: any) {
                console.error('Failed to fetch categories:', err);
                setError(err.message || 'Failed to load services');
            } finally {
                setLoading(false);
            }
        }

        fetchCategories();
    }, []);

    const getCategoryImage = (category: Category): string | null => {
        // Use primary image if available
        if (category.images && category.images.length > 0 && category.images[0]) {
            return category.images[0].url;
        }
        // Fallback to legacy image field
        if (category.image) {
            return category.image;
        }
        return null;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white py-6 md:py-8 lg:py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="bg-white rounded-lg md:rounded-xl shadow-sm p-3 sm:p-4 md:p-5 lg:p-6 animate-pulse w-full min-w-0 flex flex-col">
                                <div className="h-32 sm:h-36 md:h-40 lg:h-44 xl:h-48 bg-gray-200 rounded-lg mb-3 md:mb-4 flex-shrink-0" />
                                <div className="h-4 sm:h-5 md:h-6 bg-gray-200 rounded mb-1.5 md:mb-2" />
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center py-12">
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white py-6 md:py-8 lg:py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Our Services</h1>
                    <p className="text-sm md:text-base text-gray-600">
                        Explore our wide range of printing and design services
                    </p>
                </div>

                {/* Categories Grid */}
                {categories.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No services available at the moment.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 w-full">
                        {categories.map((category) => {
                            const imageUrl = getCategoryImage(category);

                            return (
                                <Link
                                    key={category.id}
                                    href={`/services/${category.slug}`}
                                    className="group bg-white rounded-lg md:rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer w-full min-w-0 flex flex-col"
                                >
                                    {/* Image */}
                                    <div className="relative h-32 sm:h-36 md:h-40 lg:h-44 xl:h-48 w-full bg-gray-100 overflow-hidden flex-shrink-0">
                                        {imageUrl ? (
                                            <Image
                                                src={imageUrl}
                                                alt={category.name}
                                                fill
                                                className="object-cover group-hover:scale-110 transition-transform duration-300"
                                                unoptimized={imageUrl.includes('amazonaws.com') || imageUrl.includes('s3.')}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <ImageIcon className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-3 sm:p-4 md:p-5 lg:p-6">
                                        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 md:mb-2 group-hover:text-blue-600 transition-colors">
                                            {category.name}
                                        </h3>
                                        {category.description && (
                                            <p className="text-gray-600 text-xs sm:text-sm mb-3 md:mb-4 line-clamp-2">
                                                {category.description}
                                            </p>
                                        )}
                                        <div className="flex items-center text-blue-600 font-medium text-xs sm:text-sm group-hover:gap-2 transition-all">
                                            View Service
                                            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

