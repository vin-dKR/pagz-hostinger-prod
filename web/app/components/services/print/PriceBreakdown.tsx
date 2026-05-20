import React from 'react';
import { cn } from '@/lib/utils';
import { Receipt, Loader2 } from 'lucide-react';
import { AddonBreakdownRows } from '@/app/components/AddonBreakdownRows';
import type { AddonBreakdownEntry } from '@/lib/api/cart';

interface PriceBreakdownItem {
    label: string;
    value: number;
    description?: string;
    /** Phase 3 of per-file addon pricing — per-file sub-rows surfaced
     *  underneath this row when populated (perFileEvaluation rules with
     *  2+ files). Only consumed for addon rows; ignored otherwise. */
    breakdown?: AddonBreakdownEntry[];
}

interface PriceBreakdownProps {
    items: PriceBreakdownItem[];
    total: number;
    currency?: string;
    quantity?: number;
    basePrice?: number; // Base price per unit/page
    pageCount?: number; // Number of pages (read-only) - effective page count if half-page applied
    originalPageCount?: number; // Original page count before half-page adjustment
    copies?: number; // Number of copies
    hasHalfPageAdjustment?: boolean; // Whether half-page adjustment was applied
    calculatingPrice?: boolean; // Whether price is being calculated
    className?: string;
    /** Optional resolver mapping a file URL → display filename. Wired by
     *  the services page from its in-flight upload state so per-file
     *  addon breakdown sub-rows show the user's filename instead of an
     *  opaque FTP url basename. Falls back to the URL basename when
     *  missing. */
    resolveFilename?: (fileUrl: string) => string | undefined;
}

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
    items,
    total,
    currency = '₹',
    quantity = 1,
    basePrice,
    pageCount,
    originalPageCount,
    copies,
    hasHalfPageAdjustment = false,
    calculatingPrice = false,
    className,
    resolveFilename,
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
                {calculatingPrice && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500 ml-2" />
                )}
            </h3>

            <div className={cn('space-y-3', calculatingPrice && 'opacity-60 pointer-events-none')}>
                {/* Informational items (value = 0, like half-page adjustments) - Show first 
                // WIP: Half-page adjustment items are not being shown in the price breakdown
                {items.filter((item) => item.value === 0 && !item.label.toLowerCase().startsWith('addon')).length > 0 && (
                    <div className="pb-3 border-b-2 border-blue-200 space-y-2">
                        {items
                            .filter((item) => item.value === 0 && !item.label.toLowerCase().startsWith('addon'))
                            .map((item, idx) => (
                                <div key={idx} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="flex items-start gap-2">
                                        <div className="text-blue-800 text-sm font-medium flex-1">
                                            {item.label}
                                            {item.description && (
                                                <span className="text-blue-600 block mt-1 text-xs font-normal"> – {item.description}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
                    */}

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
                            {hasHalfPageAdjustment && originalPageCount !== undefined && pageCount !== undefined && (
                                <div className="text-blue-700 mb-1">
                                    • Original Pages: <span className="font-medium">{originalPageCount} {originalPageCount === 1 ? 'page' : 'pages'}</span>
                                </div>
                            )}
                            {pageCount !== undefined && (
                                <div>
                                    • {hasHalfPageAdjustment ? 'Effective Pages' : 'Pages'} (from files): <span className="font-medium text-gray-700">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                                </div>
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

                {/* Addon lines (if any) — `breakdown` (Phase 3) expands a
                    per-file sub-row under each addon when `perFileEvaluation`
                    is on and 2+ files are uploaded. Single-entry breakdowns
                    collapse back to the parent row. */}
                {addonItems.length > 0 && (
                    <div className="pb-3 border-t border-gray-100 pt-3 space-y-1.5">
                        {addonItems.map((item, idx) => (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex justify-between items-center text-xs">
                                    <div className="text-gray-700">
                                        {item.label}
                                        {item.description && (
                                            <span className="text-gray-500"> – {item.description}</span>
                                        )}
                                    </div>
                                    <div className="font-medium text-gray-900">
                                        {currency}{Number(item.value || 0).toFixed(2)}
                                    </div>
                                </div>
                                {item.breakdown && item.breakdown.length > 1 && (
                                    <AddonBreakdownRows
                                        breakdown={item.breakdown}
                                        resolveFilename={resolveFilename}
                                        currency={currency}
                                        variant="card"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}


                {/* Total Amount */}
                <div className="pt-3 mt-3 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center">
                        <div className="font-semibold text-gray-900 text-lg">Total Price</div>
                        <div className="text-right">
                            {calculatingPrice ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm font-medium">Calculating...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="font-semibold text-blue-500 text-2xl">
                                        {currency}{Number(total || 0).toFixed(2)}
                                    </div>
                                    {showDetailedCalculation && calculatedQuantity > 1 && (
                                        <div className="text-gray-500 text-xs mt-1">
                                            {currency}{basePrice.toFixed(2)} per page × {calculatedQuantity} {calculatedQuantity === 1 ? 'page' : 'pages'}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
