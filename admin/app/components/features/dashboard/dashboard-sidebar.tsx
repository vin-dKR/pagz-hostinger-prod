'use client';

/**
 * Dashboard Sidebar Component
 * Apple-inspired navigation sidebar with subtle styling
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    FolderTree,
    LogOut,
    Users,
    Ticket,
    CreditCard,
    Star,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Image as ImageIcon,
} from 'lucide-react';
import { logoutAdmin } from '@/lib/api/auth.service';
import { setAuthToken } from '@/lib/api/api-client';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Categories', href: '/categories', icon: FolderTree },
    { name: 'Carousel', href: '/carousels', icon: ImageIcon },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Coupons', href: '/coupons', icon: Ticket },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Reviews', href: '/reviews', icon: Star },
]

export function DashboardSidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Load sidebar state from localStorage
    useEffect(() => {
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState !== null) {
            setIsCollapsed(savedState === 'true');
        }
    }, []);

    // Save sidebar state to localStorage
    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebarCollapsed', String(newState));
    };

    const handleLogout = () => {
        setAuthToken(undefined);
        logoutAdmin();
    };

    return (
        <>
            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                'flex flex-col bg-[var(--color-background-secondary)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out',
                isCollapsed ? 'w-16 lg:w-16' : 'w-64',
                isMobileOpen ? 'fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto' : 'hidden lg:flex',
                'flex-col'
            )}>
                {/* Header */}
                <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4 lg:px-6">
                    {!isCollapsed && (
                        <h2 className="text-lg font-semibold text-[var(--color-foreground)] tracking-tight whitespace-nowrap">
                            Admin Panel
                        </h2>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        {/* Mobile close button */}
                        <button
                            onClick={() => setIsMobileOpen(false)}
                            className="lg:hidden p-1.5 rounded-md hover:bg-[var(--color-accent)] transition-colors"
                            title="Close sidebar"
                        >
                            <X className="h-5 w-5 text-[var(--color-foreground-secondary)]" />
                        </button>
                        {/* Desktop collapse button */}
                        <button
                            onClick={toggleCollapse}
                            className="hidden lg:flex p-1.5 rounded-md hover:bg-[var(--color-accent)] transition-colors"
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-[var(--color-foreground-secondary)]" />
                            ) : (
                                <ChevronLeft className="h-4 w-4 text-[var(--color-foreground-secondary)]" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsMobileOpen(false)}
                                className={cn(
                                    'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm'
                                        : 'text-[var(--color-foreground-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]',
                                    isCollapsed && 'justify-center'
                                )}
                                title={isCollapsed ? item.name : undefined}
                            >
                                <item.icon className={cn(
                                    'h-5 w-5 transition-colors flex-shrink-0',
                                    isActive ? 'text-[var(--color-primary-foreground)]' : 'text-[var(--color-foreground-tertiary)]'
                                )} />
                                {!isCollapsed && (
                                    <span className="whitespace-nowrap">{item.name}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="border-t border-[var(--color-border)] p-4">
                    <button
                        onClick={handleLogout}
                        className={cn(
                            'flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-[var(--color-foreground-secondary)] transition-all duration-200 hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]',
                            isCollapsed && 'justify-center'
                        )}
                        title={isCollapsed ? 'Logout' : undefined}
                    >
                        <LogOut className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span className="whitespace-nowrap">Logout</span>}
                    </button>
                </div>
            </div>

            {/* Mobile menu button */}
            <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-[var(--color-background-secondary)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-accent)] transition-colors"
                title="Open menu"
            >
                <Menu className="h-5 w-5 text-[var(--color-foreground)]" />
            </button>
        </>
    );
}

