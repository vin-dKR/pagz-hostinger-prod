/**
 * Dashboard Layout
 * Authentication-free layout for all dashboard routes.
 */

'use client';

import { DashboardLayout } from '@/app/components/layouts/dashboard-layout';
import './management.css';

export default function Layout({ children }: { children: React.ReactNode }) {

    return <DashboardLayout><div className="admin-workspace">{children}</div></DashboardLayout>;
}
