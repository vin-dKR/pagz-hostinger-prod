/**
 * Product Half-Page Calculation Utility
 * 
 * Checks if a product has half-page options in its specifications
 * and calculates effective page count for pricing.
 */

import { prisma } from "../services/prisma.js";
import { calculateEffectivePageCount } from "./half-page-calculation.js";

/**
 * Check if a product has a half-page option in its specifications
 */
export async function checkProductHalfPageOption(productId: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            specifications: true,
        },
    });

    if (!product) {
        return false;
    }

    // Check if any specification has isHalfPage in metadata
    for (const spec of product.specifications) {
        if (spec.metadata) {
            const metadata = spec.metadata as any;
            if (metadata.isHalfPage === true) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Calculate effective page count for a product order item
 * 
 * @param productId - Product ID
 * @param pageCount - Original page count from metadata
 * @param quantity - Quantity
 * @param copies - Number of copies
 * @returns Effective page count and quantity
 */
export async function calculateProductEffectivePages(
    productId: string,
    pageCount: number | null | undefined,
    quantity: number,
    copies: number | null | undefined
): Promise<{ effectivePageCount: number; effectiveQuantity: number; hasHalfPage: boolean }> {
    const hasHalfPage = await checkProductHalfPageOption(productId);

    if (!hasHalfPage || !pageCount || pageCount === 0) {
        return {
            effectivePageCount: pageCount || 0,
            effectiveQuantity: quantity,
            hasHalfPage: false,
        };
    }

    const result = calculateEffectivePageCount(pageCount, quantity, copies || 1, true);

    return {
        effectivePageCount: result.effectivePageCount,
        effectiveQuantity: result.effectiveQuantity,
        hasHalfPage: true,
    };
}

/**
 * Get half-page breakdown entry for a product
 */
export async function getProductHalfPageBreakdown(
    productId: string,
    pageCount: number | null | undefined,
    quantity: number,
    copies: number | null | undefined
): Promise<{ label: string; value: number } | null> {
    const result = await calculateProductEffectivePages(productId, pageCount, quantity, copies);

    if (!result.hasHalfPage || result.effectivePageCount === (pageCount || 0)) {
        return null;
    }

    // Get the product to find the half-page option label
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            specifications: true,
        },
    });

    let optionLabel = "Both Side Print";
    if (product) {
        for (const spec of product.specifications) {
            if (spec.metadata) {
                const metadata = spec.metadata as any;
                if (metadata.isHalfPage === true) {
                    optionLabel = metadata.optionLabel || spec.value || "Both Side Print";
                    break;
                }
            }
        }
    }

    const isOdd = (pageCount || 0) % 2 === 1;
    const calculationNote = isOdd
        ? ` (${pageCount} ÷ 2 = ${((pageCount || 0) / 2).toFixed(1)}, rounded up to ${result.effectivePageCount})`
        : "";

    return {
        label: `${optionLabel}: ${pageCount} pages → ${result.effectivePageCount} pages${calculationNote}`,
        value: 0, // Informational only
    };
}
