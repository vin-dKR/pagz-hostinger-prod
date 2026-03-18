"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useState, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import BottomNavigation from "./BottomNavigation";

export default function ConditionalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith("/auth");
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { items: cartItems, loading: cartLoading } = useCart();
    const [isMounted, setIsMounted] = useState(false);

    // Ensure component is mounted before using client-side values
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Create a key that changes when user or cart changes to force Header re-render
    // Use consistent values during SSR to prevent hydration mismatch
    const headerKey = isMounted 
        ? `${user?.id || 'anonymous'}-${cartItems.length}-${isAuthenticated}`
        : 'ssr-initial';

    return (
        <>
            <Header key={headerKey} />
            <main className={`flex-1 bg-white ${!isAuthPage ? "pb-20 md:pb-24 lg:pb-32 xl:pb-40" : ""}`}>
                {children}
            </main>
            {!isAuthPage && <BottomNavigation />}
            {!isAuthPage && <Footer />}
        </>
    );
}

