"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid3x3, Package, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

export default function BottomNavigation() {
    const pathname = usePathname();
    const { items: cartItems } = useCart();
    const cartItemCount = cartItems.length;

    const navItems = [
        {
            label: "Home",
            href: "/",
            icon: Home,
        },
        {
            label: "All Products",
            href: "/products",
            icon: Grid3x3,
        },
        {
            label: "Services",
            href: "/services",
            icon: Package,
        },
        {
            label: "Cart",
            href: "/cart",
            icon: ShoppingCart,
            badge: cartItemCount > 0 ? cartItemCount : undefined,
        },
        {
            label: "Account",
            href: "/profile",
            icon: User,
        },
    ];

    const isActive = (href: string) => {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname.startsWith(href);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:hidden">
            <div className="flex items-center justify-around px-2 py-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center px-3 py-2 min-w-[60px] rounded-lg transition-colors ${active
                                ? "text-[#008ECC]"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            <div className="relative">
                                <Icon
                                    size={22}
                                    className={active ? "text-[#008ECC]" : "text-gray-600"}
                                    strokeWidth={active ? 2.5 : 2}
                                />
                                {item.badge && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                                        {item.badge > 99 ? "99+" : item.badge}
                                    </span>
                                )}
                                {active && (
                                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#008ECC] rounded-full"></div>
                                )}
                            </div>
                            <span
                                className={`text-xs mt-1 font-medium ${active ? "text-[#008ECC]" : "text-gray-600"
                                    }`}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

