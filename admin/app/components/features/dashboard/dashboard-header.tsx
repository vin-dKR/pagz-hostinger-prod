'use client';

import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const sections: Record<string, string> = {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    categories: 'Categories',
    carousels: 'Carousel',
    users: 'Users',
    coupons: 'Coupons',
    'shipping-methods': 'Shipping',
    payments: 'Payments',
    'orphan-payments': 'Orphan payments',
    reviews: 'Reviews',
};

export function DashboardHeader() {
    const pathname = usePathname();
    const section = sections[pathname.split('/')[1] ?? ''] ?? 'Dashboard';

    return (
        <header className="flex h-[58px] shrink-0 items-center bg-white px-3 pl-[60px] sm:px-4 sm:pl-[68px] lg:px-3">
            <div className="flex h-[38px] min-w-0 w-full items-center justify-between gap-3 rounded-[9px] border border-[#e2e2e2] bg-[#f5f5f5] px-3 shadow-[inset_0_1px_2px_rgb(36_36_36/0.035),0_1px_0_#fff]">
                <div className="flex min-w-0 items-center gap-2 text-[12px]">
                    <span className="hidden font-medium text-[#838383] sm:inline">Print E-Com</span>
                    <ChevronRight className="hidden h-3 w-3 text-[#a0a0a0] sm:block" strokeWidth={1.7} />
                    <span className="truncate font-semibold text-[#292929]">{section}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 border-l border-[#dedede] pl-3">
                    <span className="hidden text-[11px] font-medium text-[#626262] sm:inline">Admin workspace</span>
                    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-[#d7d7d7] bg-white text-[10px] font-bold text-[#292929] shadow-[0_1px_2px_rgb(36_36_36/0.06)]">A</span>
                </div>
            </div>
        </header>
    );
}
