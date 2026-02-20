"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ProfileSidebar from "@/app/components/shared/ProfileSidebar";

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 py-4 sm:py-8 pb-10 lg:pb-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                        {/* Sidebar Navigation */}
                        <div className="lg:w-64">
                            <ProfileSidebar />
                        </div>

                        {/* Main Content */}
                        <main className="flex-1">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}

