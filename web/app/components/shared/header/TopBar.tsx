/**
 * Top Bar Component
 * Displays shipping info and promotional messages
 */

'use client';

import { Truck } from 'lucide-react';

export function TopBar() {
    return (
        <div className="hidden lg:block bg-gray-100">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
                <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-600 text-xs font-light font-hkgr">
                        Free shipping on orders over ₹500
                    </div>
                    <div className="flex items-center gap-4 text-gray-600">
                        <div className="flex items-center gap-1.5">
                            <Truck size={14} />
                            <span className="font-light font-hkgr">Fast Delivery</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
