/**
 * Search Bar Component
 * Handles product search functionality
 */

'use client';

import { FormEvent } from 'react';
import { X } from 'lucide-react';

interface SearchBarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isMobile?: boolean;
    onClose?: () => void;
}

export function SearchBar({ searchQuery, setSearchQuery, isMobile = false, onClose }: SearchBarProps) {
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            if (onClose) onClose();
            window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`;
        }
    };

    if (isMobile) {
        return (
            <div className="fixed inset-0 z-[100] bg-white">
                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                        <form className="flex-1 flex gap-2" onSubmit={handleSubmit}>
                            <div className="relative flex-1 flex items-center bg-[#F3F9FB] rounded-lg border border-gray-200 px-3 py-2">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-gray-400 mr-2"
                                >
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search for products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-[#0077B5] transition-colors font-medium"
                                disabled={!searchQuery.trim()}
                            >
                                Search
                            </button>
                        </form>
                        <button
                            onClick={() => {
                                if (onClose) onClose();
                                setSearchQuery('');
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Close search"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form
            className="hidden sm:flex items-center gap-2 flex-1 max-w-xl h-full"
            onSubmit={handleSubmit}
        >
            <div className="relative flex-1 flex items-center bg-[#F3F9FB] rounded-xl border border-gray-200 px-3 py-1.5">
                <div className="pl-1 pr-1.5">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-gray-400"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </div>
                <input
                    type="text"
                    placeholder="Search for products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 py-1 px-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400 text-sm"
                />
            </div>
            <button
                type="submit"
                className="px-4 py-3 h-full bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B5] transition-colors font-medium text-xs whitespace-nowrap"
                disabled={!searchQuery.trim()}
            >
                Search
            </button>
        </form>
    );
}
