import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "./components/shared/ConditionalLayout";
import { AuthProvider } from "../contexts/AuthContext";
import { ProductConfigProvider } from "@/contexts/ProductConfigContext";
import { CartProvider } from "@/contexts/CartContext";
import { ToastProvider } from "./components/providers/toast-provider";
import { QueryProvider } from "./components/providers/query-provider";

export const metadata: Metadata = {
    title: "PAGZ - Custom Printing Solutions",
    description: "Your trusted partner for custom printing solutions. Quality products, fast delivery.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`flex flex-col min-h-screen font-hkgr`}>
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
