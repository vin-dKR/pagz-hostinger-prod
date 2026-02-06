/**
 * Mobile Menu Component
 * Side drawer menu for mobile devices
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { X, ChevronDown } from 'lucide-react';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    categories: string[];
    activeCategory: string | null;
    onCategoryChange: (category: string) => void;
}

export function MobileMenu({
    isOpen,
    onClose,
    categories,
    activeCategory,
    onCategoryChange,
}: MobileMenuProps) {
    const { user, isAuthenticated, logout, loading } = useAuth();
    const menuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    // Ensure portal only renders on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const menuContent = (
        <div className="fixed inset-0 z-[9999] sm:hidden" style={{ zIndex: 9999 }}>
            {/* Overlay - Covers entire screen including bottom nav */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity z-[9999]"
                onClick={onClose}
                style={{ zIndex: 9999 }}
            />

            {/* Menu Panel - Above overlay and bottom nav */}
            <div
                ref={menuRef}
                className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-out z-[10000]"
                style={{ zIndex: 10000 }}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold">Menu</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Close menu"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* User Section */}
                        {loading ? (
                            <div className="flex items-center gap-2 p-6">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#008ECC]"></div>
                                <span className="text-sm font-medium">Loading...</span>
                            </div>
                        ) : isAuthenticated && user ? (
                            <div className="p-6 bg-gray-50 border-b border-gray-200">
                                <p className="font-medium text-gray-900">{user?.name || user?.email}</p>
                                <p className="text-sm text-gray-600 mt-1">Welcome back!</p>
                            </div>
                        ) : (
                            <div className="p-6 border-b border-gray-200 space-y-2">
                                <Link
                                    href="/auth/login"
                                    className="block w-full px-4 py-3 bg-[#008ECC] text-white text-center rounded-lg font-medium hover:bg-[#0077B5] transition-colors"
                                    onClick={onClose}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/auth/signup"
                                    className="block w-full px-4 py-3 border border-[#008ECC] text-[#008ECC] text-center rounded-lg font-medium hover:bg-[#008ECC]/5 transition-colors"
                                    onClick={onClose}
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}

                        {/* Categories */}
                        <div className="p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Categories</h3>
                            <div className="space-y-1">
                                {categories.map((category) => {
                                    const isActive = activeCategory === category;
                                    const categorySlug = category.toLowerCase().replace(/\s+/g, '-');

                                    return (
                                        <Link
                                            key={category}
                                            href={`/products?category=${categorySlug}`}
                                            onClick={() => {
                                                onCategoryChange(category);
                                                onClose();
                                            }}
                                            className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${isActive
                                                ? 'bg-[#008ECC] text-white'
                                                : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                        >
                                            <span className="font-medium">{category}</span>
                                            <ChevronDown
                                                size={16}
                                                className={isActive ? 'text-white' : 'text-gray-400'}
                                            />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Links */}
                        <div className="p-6 border-t border-gray-200 space-y-2">
                            <Link
                                href="/offers"
                                className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                onClick={onClose}
                            >
                                All Offers
                            </Link>
                            <Link
                                href="/orders"
                                className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                onClick={onClose}
                            >
                                Track Order
                            </Link>
                            {isAuthenticated && (
                                <>
                                    <Link
                                        href="/account"
                                        className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                        onClick={onClose}
                                    >
                                        My Account
                                    </Link>
                                    <button
                                        onClick={() => {
                                            logout();
                                            onClose();
                                        }}
                                        className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render to document body using portal to ensure it's above BottomNavigation
    return createPortal(menuContent, document.body);
}
