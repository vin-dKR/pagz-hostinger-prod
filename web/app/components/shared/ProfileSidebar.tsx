"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    User, Package, MapPin, Settings, HelpCircle, LogOut, Heart,
    Menu, X, ChevronRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function ProfileSidebar() {
    const pathname = usePathname();
    const isProfilePage = pathname === "/profile";
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const router = useRouter();

    const formatMemberSince = (dateString: string): string => {
        const date = new Date(dateString);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `${month} ${year}`;
    };

    const tabs = [
        { id: "overview", label: "Overview", href: "/profile", icon: User },
        { id: "orders", label: "My Orders", href: "/orders", icon: Package },
        { id: "addresses", label: "Saved Addresses", href: "/addresses", icon: MapPin },
        { id: "wishlist", label: "Wishlist", href: "/wishlist", icon: Heart },
        { id: "settings", label: "Settings", href: "/settings", icon: Settings },
    ];

    const isActive = (href: string) => {
        if (href === "/profile") {
            return pathname === "/profile";
        }
        return pathname.startsWith(href);
    };

    // Get current active tab label for mobile header
    const activeTab = tabs.find(tab => isActive(tab.href)) || tabs[0];

    return (
        <>
            {/* Mobile Header with Toggle Button */}
            <div className="lg:hidden mb-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#008ECC] to-blue-400 flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-hkgb text-gray-900 truncate">
                                    {user?.name || user?.email?.split('@')[0] || 'User'}
                                </p>
                                <p className="text-xs text-gray-600 truncate">{activeTab?.label}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-4 h-4" />
                            ) : (
                                <Menu className="w-4 h-4" />
                            )}
                            <span className="text-sm font-medium">Menu</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
                {/* Profile Summary - Desktop Only */}
                {!isProfilePage && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#008ECC] to-blue-400 flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-hkgb text-gray-900 truncate">
                                    {user?.name || user?.email?.split('@')[0] || 'User'}
                                </p>
                                <p className="text-sm text-gray-600 truncate">{user?.email || ''}</p>
                            </div>
                        </div>
                        {user?.createdAt && (
                        <div className="border-t border-gray-100 pt-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Member Since</span>
                                    <span className="font-hkgb text-gray-900">
                                        {formatMemberSince(user.createdAt)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Primary Navigation */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <nav className="flex flex-col p-1 gap-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const active = isActive(tab.href);
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${active
                                        ? "bg-[#008ECC] py-2 text-white font-hkgb"
                                        : "text-gray-700 hover:bg-gray-50"
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />
                                    <span className="font-medium">{tab.label}</span>
                                    {active && (
                                        <div className="ml-auto w-2 h-2 rounded-full bg-white"></div>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Divider */}
                    <div className="border-t border-gray-100 mx-4"></div>

                    {/* Secondary Navigation */}
                    <div className="p-1">
                        <Link
                            href="/help"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200"
                        >
                            <HelpCircle className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">Help & Support</span>
                        </Link>
                        <button
                            onClick={() => {
                                logout();
                                router.push("/");
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <>
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Sidebar Panel */}
                    <div className="fixed inset-y-0 left-0 w-80 bg-white z-50 lg:hidden shadow-xl transform transition-transform duration-300 ease-in-out">
                        <div className="h-full flex flex-col">
                            {/* Mobile Menu Header */}
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-hkgb text-gray-900">Account Menu</h2>
                                    <button
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* User Profile in Mobile Menu */}
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#008ECC] to-blue-400 flex items-center justify-center">
                                        <User className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-hkgb text-gray-900 truncate">
                                            {user?.name || user?.email?.split('@')[0] || 'User'}
                                        </p>
                                        <p className="text-sm text-gray-600 truncate">{user?.email || ''}</p>
                                        {user?.createdAt && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Member since {formatMemberSince(user.createdAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Menu Content */}
                            <div className="flex-1 overflow-y-auto">
                                <nav className="p-2">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon;
                                        const active = isActive(tab.href);
                                        return (
                                            <Link
                                                key={tab.id}
                                                href={tab.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-200 ${active
                                                    ? "bg-[#008ECC] text-white font-hkgb"
                                                    : "text-gray-700 hover:bg-gray-50"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-500'}`} />
                                                    <span className="font-medium">{tab.label}</span>
                                                </div>
                                                <ChevronRight className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                                            </Link>
                                        );
                                    })}
                                </nav>

                                {/* Divider */}
                                <div className="border-t border-gray-100 mx-4 my-2"></div>

                                {/* Secondary Navigation */}
                                <div className="p-2">
                                    <Link
                                        href="/help"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-3">
                                            <HelpCircle className="w-4 h-4 text-gray-500" />
                                            <span className="font-medium">Help & Support</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            logout();
                                            router.push("/");
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <LogOut className="w-4 h-4" />
                                            <span className="font-medium">Logout</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Menu Footer */}
                            <div className="p-4 border-t border-gray-100">
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="w-full py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                >
                                    Close Menu
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Mobile Bottom Navigation (Alternative) */}
            {!isMobileMenuOpen && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-30">
                    <div className="flex items-center justify-around p-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const active = isActive(tab.href);
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${active
                                        ? "text-[#008ECC]"
                                        : "text-gray-600"
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-xs mt-1 font-medium">{tab.label}</span>
                                    {active && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#008ECC] mt-1"></div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
