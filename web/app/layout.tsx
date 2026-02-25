import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "./components/shared/ConditionalLayout";
import { AuthProvider } from "../contexts/AuthContext";
import { ProductConfigProvider } from "@/contexts/ProductConfigContext";
import { CartProvider } from "@/contexts/CartContext";
import { ToastProvider } from "./components/providers/toast-provider";
import { QueryProvider } from "./components/providers/query-provider";
import ChunkErrorHandler from "./components/shared/ChunkErrorHandler";

export const metadata: Metadata = {
    title: "PAGZ - Custom Printing Solutions",
    description: "PAGZ is your trusted partner for all custom printing solutions. We offer high-quality printing services including business cards, letterheads, bill books, pamphlets, maps, photo printing, book printing, and much more. With fast delivery, competitive pricing, and exceptional customer service, we help bring your printing needs to life. Order online today and experience the best in custom printing services.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`flex flex-col min-h-screen font-hkgr`}>
                <ChunkErrorHandler />
                <QueryProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <CartProvider>
                                <ProductConfigProvider>
                                    <ConditionalLayout>
                                        {children}
                                    </ConditionalLayout>
                                </ProductConfigProvider>
                            </CartProvider>
                        </AuthProvider>
                    </ToastProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
