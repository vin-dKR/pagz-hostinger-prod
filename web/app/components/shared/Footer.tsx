"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Footer() {
    const [email, setEmail] = useState("");
    const currentYear = new Date().getFullYear();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Newsletter subscription:", email);
        setEmail("");
    };

    return (
        <footer className="bg-white">
            {/* Newsletter Section - Half in content, half in footer */}
            <div className="relative">
                {/* This creates the overlap effect - positioned at top of footer, translated up by 50% */}
                <div className="absolute top-0 left-0 right-0 transform -translate-y-1/2 z-10">
                    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
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
                                <Link href="/" className="flex items-center gap-2 mb-4 md:mb-6">
                                    <Image
                                        src="/images/pagz-logo.png"
                                        alt="PAGZ logo"
                                        width={100}
                                        height={100}
                                        className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28"
                                    />
                                </Link>
                                <p className="text-gray-600 text-xs sm:text-sm mb-4 md:mb-6 lg:mb-8 leading-relaxed">
                                    We have printing solutions that suit your business needs and which you're proud to showcase. From business cards to large format prints.
                                </p>
                                <div className="flex items-center gap-1.5 md:gap-2">
                                    <a
                                        href="#"
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
                                        href="#"
                                        className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex items-center justify-center group overflow-hidden"
                                        aria-label="Twitter"
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
                                            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                                        </svg>
                                    </a>

                                    <a
                                        href="#"
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

                                    <a
                                        href="#"
                                        className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex items-center justify-center group overflow-hidden"
                                        aria-label="LinkedIn"
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
                                            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                                            <rect x="2" y="9" width="4" height="12"></rect>
                                            <circle cx="4" cy="4" r="2"></circle>
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
                                            <li><Link href="/products?category=print" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Printing</Link></li>
                                            <li><Link href="/products?category=lamination" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Lamination</Link></li>
                                            <li><Link href="/products?category=bill-book" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Bill Book</Link></li>
                                            <li><Link href="/products?category=book" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Book</Link></li>
                                            <li><Link href="/products?category=photo" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Photo</Link></li>
                                            <li><Link href="/products?category=map" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Map</Link></li>
                                            <li><Link href="/products?category=business-card" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Business Card</Link></li>
                                            <li><Link href="/products?category=brochure" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Brochure</Link></li>
                                            <li><Link href="/products?category=letterhead" className="text-gray-600 hover:text-[#008ECC] transition-colors text-xs sm:text-sm">Letterhead</Link></li>
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
                                Pagz © 2000-{currentYear}, All Rights Reserved
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
                                <div className="w-8 sm:w-10 md:w-12 h-5 sm:h-6 md:h-8 bg-white rounded border border-gray-200 flex items-center justify-center">
                                    <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-blue-700">PP</span>
                                </div>
                                <div className="w-8 sm:w-10 md:w-12 h-5 sm:h-6 md:h-8 bg-white rounded border border-gray-200 flex items-center justify-center">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
