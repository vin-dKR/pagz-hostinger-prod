/**
 * Per-category minimum cart value enforcement.
 *
 * Each Category has an optional `minCartValue`. When a category's line-total
 * sum (base + addon subtotal for items belonging to that category) is below
 * its configured minimum, order creation should be blocked and the client
 * notified which categories fell short of which amounts.
 *
 * This module centralises the rule so both the preflight validation endpoint
 * and the order-creation controller agree on the semantics.
 */

import { prisma } from "../services/prisma.js";
import type { CategoryCartShortfall } from "./errors.js";

/** A line item contribution to the per-category subtotal. */
export interface CategoryLineContribution {
    /** Product-level identifier used to look up the owning category. */
    productId: string;
    /** Line total for this item (base price + addons, after multipliers). */
    lineTotal: number;
}

/**
 * Compute per-category shortfalls for the given line items.
 *
 * Returns an empty array when every category with a configured
 * `minCartValue` has a subtotal that meets or exceeds the minimum. Items
 * whose product's category has no `minCartValue` (null or 0) are ignored.
 */
export async function computeCategoryCartShortfalls(
    lines: CategoryLineContribution[],
): Promise<CategoryCartShortfall[]> {
    if (!Array.isArray(lines) || lines.length === 0) {
        return [];
    }

    const productIds = Array.from(
        new Set(
            lines
                .map((line) => line.productId)
                .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
    );

    if (productIds.length === 0) {
        return [];
    }

    // Fetch the category for each distinct product in a single query.
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
            id: true,
            categoryId: true,
            category: {
                select: {
                    id: true,
                    name: true,
                    minCartValue: true,
                },
            },
        },
    });

    const productCategory = new Map<string, {
        id: string;
        name: string;
        minCartValue: number | null;
    } | null>();

    for (const p of products) {
        if (p.category && p.category.minCartValue !== null && p.category.minCartValue !== undefined) {
            const minValue = Number(p.category.minCartValue);
            productCategory.set(p.id, {
                id: p.category.id,
                name: p.category.name,
                minCartValue: Number.isFinite(minValue) && minValue > 0 ? minValue : null,
            });
        } else if (p.category) {
            productCategory.set(p.id, {
                id: p.category.id,
                name: p.category.name,
                minCartValue: null,
            });
        } else {
            productCategory.set(p.id, null);
        }
    }

    // Sum line totals per category, but only track categories that have a minimum.
    const totals = new Map<string, { name: string; required: number; current: number }>();

    for (const line of lines) {
        const cat = productCategory.get(line.productId);
        if (!cat || cat.minCartValue === null) continue;

        const existing = totals.get(cat.id);
        if (existing) {
            existing.current += line.lineTotal;
        } else {
            totals.set(cat.id, {
                name: cat.name,
                required: cat.minCartValue,
                current: line.lineTotal,
            });
        }
    }

    const shortfalls: CategoryCartShortfall[] = [];
    for (const [categoryId, info] of totals.entries()) {
        // Use a small epsilon to avoid floating-point false positives when
        // the current total rounds to exactly the required amount.
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

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
