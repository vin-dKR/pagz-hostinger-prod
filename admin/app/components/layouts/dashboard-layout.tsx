/**
 * Dashboard Layout Component
 * Apple-inspired layout with clean structure and generous spacing
 */

import { DashboardSidebar } from '@/app/components/features/dashboard/dashboard-sidebar';
import { DashboardHeader } from '@/app/components/features/dashboard/dashboard-header';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
            <DashboardSidebar />
            <div className="flex flex-1 flex-col overflow-hidden lg:ml-0">
                <DashboardHeader />
                <main className="flex-1 overflow-y-auto bg-[var(--color-background)] p-4 lg:px-4 lg:py-6 smooth-scroll">
                    {children}
                </main>
            </div>
        </div>
    );
}

