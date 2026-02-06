"use client";

import Link from "next/link";
import { useState } from "react";

interface Product {
    id: string;
    name: string;
    currentPrice: number;
    originalPrice: number;
    discount: number;
    image: string;
    isFavorite: boolean;
}

export default function ProductListing() {
    const [products, setProducts] = useState<Product[]>([
        {
            id: "1",
            name: "Printed T- Mug with Your Family Photo",
            currentPrice: 599,
            originalPrice: 1500,
            discount: 15,
            image: "/products/mug-family.jpg",
            isFavorite: false,
        },
        {
            id: "2",
            name: "Daraz Like New Smart Watches - Samsung...",
            currentPrice: 599,
            originalPrice: 1500,
            discount: 15,
            image: "/products/watch-samsung.jpg",
            isFavorite: false,
        },
        {
            id: "3",
            name: "Daraz Like New Smart Watches - SAMSUNG...",
            currentPrice: 599,
            originalPrice: 1500,
            discount: 15,
            image: "/products/watch-samsung2.jpg",
            isFavorite: false,
        },
        {
            id: "4",
            name: "Daraz Like New Smart Watches - Apple Watch...",
            currentPrice: 599,
            originalPrice: 1500,
            discount: 15,
            image: "/products/watch-apple.jpg",
            isFavorite: false,
        },
        {
            id: "5",
            name: "Smart Quality Square Digital Silicon Sports...",
            currentPrice: 599,
            originalPrice: 1500,
            discount: 15,
            image: "/products/watch-sports.jpg",
            isFavorite: false,
        },
    ]);

    const toggleFavorite = (productId: string) => {
        setProducts((prev) =>
            prev.map((product) =>
                product.id === productId
                    ? { ...product, isFavorite: !product.isFavorite }
                    : product
            )
        );
    };

    return (
        <section className="py-12 bg-gray-50 relative">
            <div className="max-w-7xl mx-auto px-6">
                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-6 pb-4 relative" style={{ minWidth: "max-content" }}>
                        {products.map((product) => (
                            <div
                                key={product.id}
                                className="flex-shrink-0 w-64 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden relative"
                            >
                                {/* Product Image */}
                                <Link href={`/products/${product.id}`} className="block relative aspect-square bg-gray-100">
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                        <span className="text-gray-400 text-sm">Product Image</span>
                                    </div>

                                    {/* Favorite Button */}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            toggleFavorite(product.id);
                                        }}
                                        className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
                                        aria-label="Add to favorites"
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill={product.isFavorite ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className={product.isFavorite ? "text-red-500" : "text-gray-600"}
                                        >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                        </svg>
                                    </button>
                                </Link>

                                {/* Product Info */}
                                <div className="p-4">
                                    <Link href={`/products/${product.id}`}>
                                        <h3 className="text-sm font-medium text-gray-900 mb-3 line-clamp-2">
                                            {product.name}
                                        </h3>
                                        <div className="space-y-1">
                                            <p className="text-xl font-bold text-gray-900">
                                                Rs.{product.currentPrice}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-gray-500 line-through">
                                                    Rs.{product.originalPrice}
                                                </p>
                                                <span className="text-sm font-semibold text-red-600">
                                                    -{product.discount}%
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation Arrows */}
                <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                        className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                        aria-label="Previous products"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-700"
                        >
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <button
                        className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                        aria-label="Next products"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-700"
                        >
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    );
}
