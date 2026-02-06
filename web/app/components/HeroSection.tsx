"use client";

import { useState } from "react";
import Link from "next/link";

export default function HeroSection() {
    const [searchQuery, setSearchQuery] = useState("");

    const categories = [
        { name: "Visiting Card", href: "/products?category=visiting-card" },
        { name: "T shirt", href: "/products?category=t-shirt" },
        { name: "Business Profile", href: "/products?category=business-profile" },
        { name: "Accessories", href: "/products?category=accessories" },
    ];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
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
                        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 font-serif italic">
                            Print Your Vision.<br className="hidden md:block" /> Quality Printing Services.
                        </h1>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="mb-6 md:mb-6">
                            <div className="relative flex items-center bg-white rounded-full shadow-lg max-w-2xl mx-auto">
                                <input
                                    type="text"
                                    placeholder="Search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 px-4 md:px-6 py-2.5 md:py-3 rounded-full outline-none text-gray-900 placeholder:text-gray-400 text-sm md:text-base"
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
                        </form>

                        {/* Category Buttons */}
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
                    </div>
                </div>
            </div>
        </section>
    );
}
