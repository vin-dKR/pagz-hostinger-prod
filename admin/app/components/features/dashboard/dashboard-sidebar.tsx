'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { sidebarIcons } from './sidebar-icons';

const navigation = [
    {
        label: 'Overview',
        items: [{ name: 'Dashboard', href: '/dashboard', icon: sidebarIcons.dashboard }],
    },
    {
        label: 'Catalog',
        items: [
            { name: 'Products', href: '/products', icon: sidebarIcons.products },
            { name: 'Categories', href: '/categories', icon: sidebarIcons.categories },
            { name: 'Carousel', href: '/carousels', icon: sidebarIcons.carousel },
        ],
    },
    {
        label: 'Operations',
        items: [
            { name: 'Orders', href: '/orders', icon: sidebarIcons.orders },
            { name: 'Payments', href: '/payments', icon: sidebarIcons.payments },
            { name: 'Orphan payments', href: '/orphan-payments', icon: sidebarIcons.orphanPayments },
            { name: 'Shipping', href: '/shipping-methods', icon: sidebarIcons.shipping },
        ],
    },
    {
        label: 'Customers & growth',
        items: [
            { name: 'Users', href: '/users', icon: sidebarIcons.users },
            { name: 'Coupons', href: '/coupons', icon: sidebarIcons.coupons },
            { name: 'Reviews', href: '/reviews', icon: sidebarIcons.reviews },
        ],
    },
];

export function DashboardSidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        setIsCollapsed(localStorage.getItem('sidebarCollapsed') === 'true');
    }, []);

    useEffect(() => {
        if (!isMobileOpen) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsMobileOpen(false);
        };

        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isMobileOpen]);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('sidebarCollapsed', String(next));
    };

    return (
        <>
            <button
                type="button"
                aria-label="Open navigation"
                aria-controls="admin-sidebar"
                aria-expanded={isMobileOpen}
                onClick={() => setIsMobileOpen(true)}
                className="fixed left-3 top-3 z-30 inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-[#d3d3d3] bg-[#ededed] text-[#383838] shadow-[0_1px_2px_rgb(24_24_24/0.08)] hover:bg-white lg:hidden"
            >
                <Menu className="h-[18px] w-[18px]" />
            </button>

            {isMobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setIsMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-[#222]/35 backdrop-blur-[2px] lg:hidden"
                />
            )}

            <aside
                id="admin-sidebar"
                aria-label="Admin navigation"
                className={cn(
                    'z-50 flex h-full w-[240px] shrink-0 flex-col border-r border-[#d6d6d6] bg-[#ededed] transition-[width,transform] duration-200 ease-out lg:relative lg:z-auto lg:mr-[7px] lg:w-[220px] lg:border-r-0',
                    isCollapsed && 'lg:w-[58px]',
                    isMobileOpen
                        ? 'fixed inset-y-0 left-0 shadow-[10px_0_28px_rgb(24_24_24/0.18)]'
                        : 'fixed inset-y-0 left-0 -translate-x-full lg:translate-x-0'
                )}
            >
                <div className={cn('flex h-[58px] shrink-0 items-center gap-2.5 border-b border-[#d8d8d8] px-3', isCollapsed && 'lg:justify-center lg:px-1')}>
                    <div className="relative h-[31px] w-[31px] shrink-0">
                        <span aria-hidden="true" className="absolute inset-[2px] translate-x-[2px] translate-y-[2px] rotate-[7deg] rounded-[7px] border border-[#bcbcbc] bg-white" />
                        <span className="absolute inset-0 flex items-center justify-center rounded-[7px] bg-[#282828] text-[19px] font-black leading-none tracking-[-0.12em] text-white shadow-[0_2px_4px_rgb(24_24_24/0.14)]">P<span className="self-end pb-[5px] text-[11px]">.</span></span>
                    </div>
                    <div className={cn('min-w-0 flex-1', isCollapsed && 'lg:sr-only')}>
                        <p className="truncate text-[14px] font-black leading-none tracking-[-0.055em] text-[#242424]">Print E-Com</p>
                        <p className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-[0.19em] text-[#888]">Operations</p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setIsMobileOpen(false)}
                        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[#555] hover:bg-white lg:hidden"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <nav className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-2.5 py-4" aria-label="Sections">
                    {navigation.map((group, index) => (
                        <div key={group.label} className={cn(index > 0 && 'border-t border-[#d9d9d9] pt-3')}>
                            <p className={cn('mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b8b8b]', isCollapsed && 'lg:sr-only')}>
                                {group.label}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={isCollapsed ? item.name : undefined}
                                            aria-current={isActive ? 'page' : undefined}
                                            onClick={() => setIsMobileOpen(false)}
                                            className={cn(
                                                'group relative flex h-[35px] items-center gap-2.5 rounded-[9px] border px-2.5 text-[12px] transition-[background-color,border-color,box-shadow,color]',
                                                isActive
                                                    ? 'border-[#d6d6d6] bg-white font-semibold text-[#242424] shadow-[0_1px_2px_rgb(24_24_24/0.07),inset_0_1px_0_#fff]'
                                                    : 'border-transparent font-medium text-[#555] hover:border-[#d9d9d9] hover:bg-[#f5f5f5] hover:text-[#242424]',
                                                isCollapsed && 'lg:justify-center lg:px-0'
                                            )}
                                        >
                                            <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-[#262626]' : 'text-[#727272] group-hover:text-[#343434]')} />
                                            <span className={cn('truncate', isCollapsed && 'lg:sr-only')}>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="shrink-0 border-t border-[#d7d7d7] p-2.5">
                    <div className={cn('flex items-center gap-2.5 rounded-[9px] px-1.5 py-1.5', isCollapsed && 'lg:justify-center lg:px-0')}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[#d2d2d2] bg-white text-[10px] font-bold text-[#282828] shadow-[0_1px_2px_rgb(24_24_24/0.055)]">A</div>
                        <div className={cn('min-w-0', isCollapsed && 'lg:sr-only')}>
                            <p className="truncate text-[11px] font-semibold text-[#353535]">Admin workspace</p>
                            <p className="truncate text-[10px] text-[#8a8a8a]">Store management</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={toggleCollapse}
                        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className={cn('mt-0.5 hidden h-7 w-full items-center gap-2 rounded-[7px] px-2 text-[11px] font-medium text-[#888] hover:bg-white hover:text-[#292929] lg:flex', isCollapsed && 'justify-center px-0')}
                    >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        {!isCollapsed && <span>Collapse sidebar</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
