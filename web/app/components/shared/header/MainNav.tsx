/**
 * Main Navigation Component
 * Logo, search, cart, and user menu
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BadgePercent, ShoppingCart, Menu } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { SearchBar } from './SearchBar';
import { UserMenu } from './UserMenu';

interface MainNavProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
    onMenuToggle: () => void;
}

export function MainNav({
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    onMenuToggle,
}: MainNavProps) {
    const { items: cartItems } = useCart();
    const cartItemCount = cartItems.length;

    return (
        <>
            {/* Top Bar */}
            <div className="hidden lg:block bg-gray-100">
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <div className="text-gray-600 text-xs font-light font-hkgr">
                            Welcome to worldwide Megamart!
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <Link
                                href="/orders"
                                className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                <BadgePercent strokeWidth={1} color="#008ECC" size={18} />
                                <span>Track your order</span>
                            </Link>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <Link
                                href="/offers"
                                className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                <BadgePercent strokeWidth={1} color="#008ECC" size={18} />
                                <span>All Offers</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Header */}
            <div className="bg-white w-full border-b border-gray-100">
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-3 sm:gap-4 py-3">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 shrink-0">
                            <Image
                                src="/images/pagz-logo.png"
                                alt="PAGZ logo"
                                width={72}
                                height={72}
                                className="w-16 h-16 lg:w-20 lg:h-20"
                                priority
                            />
                        </Link>

                        {/* Search Bar - Desktop */}
                        <SearchBar
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            isMobile={false}
                        />

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                            {/* Mobile Search Button */}
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="Open search"
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
                                >
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                            </button>

                            {/* Cart */}
                            <Link
                                href="/cart"
                                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ShoppingCart size={22} />
                                {cartItemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-[#008ECC] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                        {cartItemCount > 9 ? '9+' : cartItemCount}
                                    </span>
                                )}
                            </Link>

                            {/* User Menu */}
                            <div className="hidden sm:block">
                                <UserMenu />
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={onMenuToggle}
                                className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="Toggle menu"
                            >
                                <Menu size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Search Modal */}
            {isSearchOpen && (
                <SearchBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    isMobile={true}
                    onClose={() => setIsSearchOpen(false)}
                />
            )}
        </>
    );
}
