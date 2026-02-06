'use client';

/**
 * Dashboard Header Component
 */

import { Button } from '@/app/components/ui/button';
import { LogOut } from 'lucide-react';
import { logoutAdmin } from '@/lib/api/auth.service';
import { setAuthToken } from '@/lib/api/api-client';

export function DashboardHeader() {
    const handleLogout = () => {
        setAuthToken(undefined);
        logoutAdmin();
    };

    return (
        <header className="flex h-16 items-center border-b border-[var(--color-border)] bg-[var(--color-background)] px-6">
            <div className="flex flex-1 items-center justify-between">
                <h1 className="text-base font-medium text-[var(--color-foreground)]">
                    Welcome back, Admin
                </h1>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="flex items-center gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </div>
        </header>
    );
}

