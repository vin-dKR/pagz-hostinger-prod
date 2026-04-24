/**
 * Per-category minimum cart value — client helper.
 *
 * The server is the source of truth (see
 * api/src/utils/category-min-cart-value.ts and the /cart/validate-minimums
 * endpoint). This helper mirrors the math locally so the cart page can
 * display per-category shortfall warnings and disable "Proceed to
 * Checkout" without a round-trip for every quantity change.
 */

import type { CartItem, CategoryCartShortfall } from '@/lib/api/cart';

/** Read the line total (base + addons) for a cart item, falling back to
 * product price × quantity if the server-side pricing block is missing. */
function computeLineTotal(item: CartItem): number {
    const pricing = (item as unknown as {
        pricing?: { total?: number | string | null; baseTotal?: number | string | null; addonTotal?: number | string | null };
    }).pricing;

    if (pricing && pricing.total != null) {
        return Number(pricing.total) || 0;
    }

    // Fallback (used mainly on the very first render before the server
    // pricing block arrives). Does not account for half-page / file
    // multipliers — the API response will supersede it in practice.
    const unitPrice = Number(item.product?.sellingPrice || item.product?.basePrice || 0);
    const variantModifier = Number(item.variant?.priceModifier || 0);
    return (unitPrice + variantModifier) * (item.quantity || 0);
}

/**
 * Group cart items by category and return each category's current subtotal
 * alongside its configured minimum. Only categories with a positive
 * `minCartValue` are returned — everything else is unrestricted.
 */
export function computeCategoryShortfalls(items: CartItem[]): CategoryCartShortfall[] {
    const totals = new Map<string, {
        name: string;
        required: number;
        current: number;
    }>();

    for (const item of items) {
        const category = item.product?.category;
        if (!category || !category.id) continue;

        const required = Number(category.minCartValue ?? 0);
        if (!Number.isFinite(required) || required <= 0) continue;

        const lineTotal = computeLineTotal(item);
        const existing = totals.get(category.id);
        if (existing) {
            existing.current += lineTotal;
        } else {
            totals.set(category.id, {
                name: category.name,
                required,
                current: lineTotal,
            });
        }
    }

    const shortfalls: CategoryCartShortfall[] = [];
    for (const [categoryId, info] of totals.entries()) {
        if (info.current + 1e-6 < info.required) {
            shortfalls.push({
                categoryId,
                categoryName: info.name,
                required: round2(info.required),
                current: round2(info.current),
            });
        }
    }
    return shortfalls;
}

/** Format a rupee amount for inline display (₹1,234.50). Falls back to
 *  string coercion when Intl isn't available (older SSR paths). */
export function formatInr(value: number): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `₹${value.toFixed(2)}`;
    }
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
