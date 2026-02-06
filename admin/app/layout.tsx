import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/app/components/providers/toast-provider';
import { QueryProvider } from '@/app/components/providers/query-provider';

export const metadata: Metadata = {
    title: 'Admin Panel - Print E-Com',
    description: 'Admin panel for managing the e-print store',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <QueryProvider>
                    <ToastProvider>{children}</ToastProvider>
                </QueryProvider>
            </body>
        </html>
    );
}

