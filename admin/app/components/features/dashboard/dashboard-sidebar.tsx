'use client';

/**
 * Dashboard Sidebar Component
 * Apple-inspired navigation sidebar with subtle styling
 */

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
} from 'lucide-react';
import { logoutAdmin } from '@/lib/api/auth.service';
import { setAuthToken } from '@/lib/api/api-client';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Orders', href: '/orders', icon: ShoppingCart },
    { name: 'Categories', href: '/categories', icon: FolderTree },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Coupons', href: '/coupons', icon: Ticket },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Reviews', href: '/reviews', icon: Star },
]

export function DashboardSidebar() {
    const pathname = usePathname();

    const handleLogout = () => {
        setAuthToken(undefined);
        logoutAdmin();
    };

    return (
        <div className="flex w-64 flex-col bg-[var(--color-background-secondary)] border-r border-[var(--color-border)]">
            <div className="flex h-16 items-center border-b border-[var(--color-border)] px-6">
                <h2 className="text-lg font-semibold text-[var(--color-foreground)] tracking-tight">Admin Panel</h2>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm'
                                    : 'text-[var(--color-foreground-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                            )}
                        >
                            <item.icon className={cn(
                                'h-5 w-5 transition-colors',
                                isActive ? 'text-[var(--color-primary-foreground)]' : 'text-[var(--color-foreground-tertiary)]'
                            )} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-[var(--color-border)] p-4">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-[var(--color-foreground-secondary)] transition-all duration-200 hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
                >
                    <LogOut className="h-5 w-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}

