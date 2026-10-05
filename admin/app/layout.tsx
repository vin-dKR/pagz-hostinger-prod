import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/app/components/providers/toast-provider';
import { QueryProvider } from '@/app/components/providers/query-provider';

export const metadata: Metadata = {
    title: 'Print E-Com | Admin Console',
    description: 'Manage the Print E-Com store',
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
