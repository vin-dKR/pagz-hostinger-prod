import React from 'react';
import { cn } from '@/lib/utils';
import { Receipt } from 'lucide-react';

interface PriceBreakdownItem {
    label: string;
    value: number;
    description?: string;
}

interface PriceBreakdownProps {
    items: PriceBreakdownItem[];
    total: number;
    currency?: string;
    quantity?: number;
    basePrice?: number; // Base price per unit/page
    pageCount?: number; // Number of pages (read-only)
    copies?: number; // Number of copies
    className?: string;
}

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
    items,
    total,
    currency = '₹',
    quantity = 1,
    basePrice,
    pageCount,
    copies,
    className,
}) => {
    const showDetailedCalculation = basePrice !== undefined && basePrice > 0;
    const calculatedQuantity = pageCount && copies ? pageCount * copies : quantity;
    const calculatedTotal = showDetailedCalculation ? basePrice * calculatedQuantity : total;

    const addonItems = items.filter((item) =>
        item.label.toLowerCase().startsWith('addon')
    );

    return (
        <div className={cn('space-y-4', className)}>
            <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-gray-600" />
                Price Breakdown
            </h3>

            <div className="space-y-3">
                {/* Base Price Display */}
                {showDetailedCalculation && (
                    <div className="pb-3 border-b-2 border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <div className="text-gray-700 text-sm font-medium">Base Price (per page)</div>
                                <div className="text-gray-500 text-xs mt-0.5">Price for one page/unit</div>
                            </div>
                            <div className="font-medium text-gray-900 text-sm">
                                {currency}{basePrice.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Quantity Calculation */}
                {showDetailedCalculation && (pageCount !== undefined || copies !== undefined) && (
                    <div className="pb-3 border-b border-gray-100">
                        <div className="text-gray-700 text-sm font-medium mb-2">Quantity:</div>
                        <div className="space-y-1 text-xs text-gray-600 ml-4">
                            {pageCount !== undefined && (
                                <div>• Pages (from files): <span className="font-medium text-gray-700">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span></div>
                            )}
                            {copies !== undefined && copies > 0 && (
                                <div>• Copies: <span className="font-medium text-gray-700">{copies} {copies === 1 ? 'copy' : 'copies'}</span></div>
                            )}
                            <div className="font-medium text-gray-900 mt-2">
                                Total Quantity: {calculatedQuantity} {calculatedQuantity === 1 ? 'page' : 'pages'}
                                {pageCount !== undefined && copies !== undefined && (
                                    <span className="text-gray-600 font-normal"> ({pageCount} × {copies})</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Price Calculation */}
                {showDetailedCalculation && (
                    <div className="pb-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="text-gray-700 text-sm font-medium">Subtotal</div>
                                <div className="text-gray-500 text-xs mt-0.5">
                                    {currency}{basePrice.toFixed(2)} × {calculatedQuantity} {calculatedQuantity === 1 ? 'page' : 'pages'}
                                </div>
                            </div>
                            <div className="font-medium text-gray-900 text-sm">
                                {currency}{calculatedTotal.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Addon lines (if any) */}
                {addonItems.length > 0 && (
                    <div className="pb-3 border-t border-gray-100 pt-3 space-y-1">
                        {addonItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="text-gray-700">
                                    {item.label}
                                    {item.description && (
                                        <span className="text-gray-500"> – {item.description}</span>
                                    )}
                                </div>
                                <div className="font-medium text-gray-900">
                                    {currency}{item.value.toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                {/* Total Amount */}
                <div className="pt-3 mt-3 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center">
                        <div className="font-semibold text-gray-900 text-lg">Total Price</div>
                        <div className="text-right">
                            <div className="font-semibold text-blue-500 text-2xl">
                                {currency}{total.toFixed(2)}
                            </div>
                            {showDetailedCalculation && calculatedQuantity > 1 && (
                                <div className="text-gray-500 text-xs mt-1">
                                    {currency}{basePrice.toFixed(2)} per page × {calculatedQuantity} {calculatedQuantity === 1 ? 'page' : 'pages'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
