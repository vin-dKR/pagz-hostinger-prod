"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import Header from "./Header";
import Footer from "./Footer";

export default function ConditionalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith("/auth");
    const { user, isAuthenticated } = useAuth();
    const { items: cartItems } = useCart();

    // Create a key that changes when user or cart changes to force Header re-render
    const headerKey = `${user?.id || 'anonymous'}-${cartItems.length}-${isAuthenticated}`;

    return (
        <>
            <Header key={headerKey} />
            <main className={`flex-1 bg-white ${!isAuthPage ? "pb-20 md:pb-24 lg:pb-32 xl:pb-40" : ""}`}>
                {children}
            </main>
            {!isAuthPage && <Footer />}
        </>
    );
}

