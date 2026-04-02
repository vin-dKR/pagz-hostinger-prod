"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCategories } from "@/lib/hooks/use-categories";

export default function Footer() {
    const [email, setEmail] = useState("");
    const currentYear = new Date().getFullYear();
    const { data: categories = [] } = useCategories();

    // Top 9 real categories (no hardcoding). If API returns priority/isActive, respect it.
    const topCategories = categories
        .filter((c: any) => c && (c.isActive === undefined || c.isActive))
        .sort((a: any, b: any) => {
            const pa = typeof a?.priority === "number" ? a.priority : Number.POSITIVE_INFINITY;
            const pb = typeof b?.priority === "number" ? b.priority : Number.POSITIVE_INFINITY;
            if (pa !== pb) return pa - pb;
            return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
        })
        .slice(0, 9);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setEmail("");
    };

    return (
        <footer className="bg-white">
            {/* Newsletter Section - Half in content, half in footer */}
            <div className="relative">
                {/* This creates the overlap effect - positioned at top of footer, translated up by 50% */}
                <div className="absolute top-0 left-0 right-0 transform -translate-y-1/2 ">
                    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="bg-[#1EADD8] rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 lg:p-8 px-4 md:px-8 lg:px-20">
                            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 md:gap-6">
                                <div className="flex-1 text-center lg:text-left">
                                    <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-hkgb font-bold text-white">
                                        Grow Your Brand With
                                    </h3>
                                    <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-hkgb font-bold text-white">
                                        Professional Printing Solutions
                                    </h3>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full lg:w-auto lg:min-w-[300px] xl:min-w-[400px]">
                                    <div className="relative flex-1">
                                        <div className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2">
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="text-gray-400 md:w-5 md:h-5"
                                            >
                                                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                                            </svg>
                                        </div>
                                        <input
                                            type="email"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2 md:py-2.5 lg:py-3 rounded-full bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-300 text-sm md:text-base"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        className="px-4 md:px-6 py-2 md:py-2.5 lg:py-3 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-colors whitespace-nowrap text-sm md:text-base"
                                    >
                                        Subscribe
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spacer to accommodate the newsletter section */}
            <div className="pt-16 md:pt-20 lg:pt-32 xl:pt-40 bg-white lg:bg-[#F0F0F0]">
                {/* Main Footer Content */}
                <div className="bg-[#F0F0F0]">
                    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 lg:py-12">
                        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12 xl:gap-24">
                            {/* Column 1: Brand Info - Fixed width */}
                            <div className="lg:w-[280px] xl:w-[350px]">
                                <Link href="/" className="flex items-center gap-2 mb-4 md:mb-6 mt-10 sm:mt-0">
                                    <Image
                                        src="/images/logo.png"
                                        alt="PAGZ logo"
                                        width={3860}
                                        height={819}
                                        className="w-32 h-auto sm:w-40 sm:h-auto md:w-48 md:h-auto lg:w-54 lg:h-auto"
                                        priority
                                    />
                                </Link>
                                <p className="text-gray-600 text-xs sm:text-sm mb-4 md:mb-6 lg:mb-8 leading-relaxed">
                                    We have printing solutions that suit your business needs and which you're proud to showcase. From business cards to large format prints.
                                </p>
                                <div className="flex items-center gap-1.5 md:gap-2">
                                    <a
                                        href="https://www.facebook.com/profile.php?id=61582167934434"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex items-center justify-center group overflow-hidden"
                                        aria-label="Facebook"
                                    >
                                        <div className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="relative z-10 text-gray-600 group-hover:text-gray-900 group-hover:scale-110 transition-all duration-200 md:w-3.5 md:h-3.5"
                                        >
                                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                                        </svg>
                                    </a>

                                    <a
                                        href="https://www.instagram.com/pagz.in"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex items-center justify-center group overflow-hidden"
                                        aria-label="Instagram"
                                    >
                                        <div className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="relative z-10 text-gray-600 group-hover:text-gray-900 group-hover:scale-110 transition-all duration-200 md:w-3.5 md:h-3.5"
                                        >
                                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                                        </svg>
                                    </a>

                                </div>
                            </div>

                            {/* Columns 2-5: Takes remaining space */}
                            <div className="flex-1">
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 lg:gap-12">
                                    {/* Column 2: INFORMATION */}
                                    <div>
                                        <h4 className="text-sm sm:text-base font-hkgb font-normal text-gray-900 mb-2 sm:mb-3 md:mb-4">INFORMATION</h4>
                                        <ul className="space-y-1.5 sm:space-y-2 lg:space-y-3">
                                            <li><Link href="/about" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">About Us</Link></li>
                                            <li><Link href="/contact" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Contact Us</Link></li>
                                            <li><Link href="/privacy" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Privacy Policy</Link></li>
                                            <li><Link href="/refund" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Refund and Cancellation policy</Link></li>
                                            <li><Link href="/return" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Return Policy</Link></li>
                                            <li><Link href="/shipping" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Shipping Policy</Link></li>
                                            <li><Link href="/terms" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Terms & Conditions</Link></li>
                                        </ul>
                                    </div>

                                    {/* Column 3: ACCOUNT */}
                                    <div>
                                        <h4 className="text-sm sm:text-base font-hkgb font-normal text-gray-900 mb-2 sm:mb-3 md:mb-4">ACCOUNT</h4>
                                        <ul className="space-y-1.5 sm:space-y-2 lg:space-y-3">
                                            <li><Link href="/profile" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">My account</Link></li>
                                            <li><Link href="/orders" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">My Orders</Link></li>
                                            <li><Link href="/orders" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Order Tracking</Link></li>
                                            <li><Link href="/wishlist" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">My Wishlist</Link></li>
                                            <li><Link href="/settings" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Account details</Link></li>
                                        </ul>
                                    </div>

                                    {/* Column 4: CATEGORIES */}
                                    <div>
                                        <h4 className="text-sm sm:text-base font-hkgb font-normal text-gray-900 mb-2 sm:mb-3 md:mb-4">CATEGORIES</h4>
                                        <ul className="space-y-1.5 sm:space-y-2 lg:space-y-3">
                                            {topCategories.map((cat: any) => (
                                                <li key={cat.id ?? cat.slug ?? cat.name}>
                                                    <Link
                                                        href={`/services/${cat.slug}`}
                                                        className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm"
                                                    >
                                                        {cat.name}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Column 5: VISIT US */}
                                    <div>
                                        <h4 className="text-sm sm:text-base font-hkgb font-normal text-gray-900 mb-2 sm:mb-3 md:mb-4">VISIT US</h4>
                                        <div className="space-y-1 md:space-y-1.5 text-gray-600 text-xs sm:text-sm">
                                            <p>Our store is located at</p>
                                            <p>Amber Chowk, Kahchari</p>
                                            <p>Road, Bihar Sharif</p>
                                            <p>(Nalanda), pin-803101</p>
                                            <p className="pt-2 font-medium text-gray-900">Contact</p>
                                            <p>
                                                <a href="tel:7500905010" className="hover:text-[#008ECC] transition-colors">
                                                    7500905010
                                                </a>
                                            </p>
                                            <p>
                                                <a href="mailto:info@pagz.in" className="hover:text-[#008ECC] transition-colors">
                                                    info@pagz.in
                                                </a>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-gray-200 bg-gray-50">
                    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
                            <p className="text-xs sm:text-sm text-gray-600 text-center md:text-left">
                                Pagz © {currentYear}, All rights reserved
                            </p>
                            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 flex-wrap justify-center">
                                <div className="w-8 sm:w-10 md:w-12 h-5 sm:h-6 md:h-8 bg-white rounded border border-gray-200 flex items-center justify-center">
                                    <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-blue-900">VISA</span>
                                </div>
                                <div className="w-8 sm:w-10 md:w-12 h-5 sm:h-6 md:h-8 bg-white rounded border border-gray-200 flex items-center justify-center">
                                    <div className="flex items-center gap-0.5 scale-75 sm:scale-90 md:scale-100">
                                        <div className="w-2 sm:w-2.5 md:w-3 h-2 sm:h-2.5 md:h-3 rounded-full bg-red-500"></div>
                                        <div className="w-2 sm:w-2.5 md:w-3 h-2 sm:h-2.5 md:h-3 rounded-full bg-yellow-500 -ml-1"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
