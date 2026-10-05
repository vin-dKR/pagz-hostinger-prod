import { DashboardSidebar } from '@/app/components/features/dashboard/dashboard-sidebar';
import { DashboardHeader } from '@/app/components/features/dashboard/dashboard-header';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-dvh min-h-0 overflow-hidden bg-[#ededed] lg:p-[7px]">
            <DashboardSidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden border border-[#dedede] bg-white shadow-[0_1px_4px_rgb(24_24_24/0.045)] lg:rounded-[15px]">
                <DashboardHeader />
                <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fcfcfc] px-4 pb-10 pt-3.5 sm:px-6 lg:px-7 lg:pt-4 xl:px-8">
                    <div className="mx-auto w-full max-w-[1740px]">{children}</div>
                </main>
            </div>
        </div>
    );
}
