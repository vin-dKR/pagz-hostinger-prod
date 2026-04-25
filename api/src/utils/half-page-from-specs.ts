/**
 * Server-side half-page detection from user-selected specifications.
 *
 * Looks up the live `CategorySpecificationOption.metadata.isHalfPage`
 * flag against the cart item's stored `metadata.specifications`. Used by
 * the cart and order controllers as the authoritative half-page check —
 * `ProductSpecification.metadata` is a snapshot taken at publish time
 * and lags products published before the option's `isHalfPage` flag was
 * added, so falling back to it lets some half-page jobs price as full.
 *
 * Crucially, this util ignores any client-supplied
 * `hasHalfPageAdjustment` / `effectivePageCount` fields: trusting those
 * would let a guest set `effectivePageCount: 1` on a 100-page job and
 * pay ₹1 instead of ₹100. The server alone decides whether half-page
 * applies, by looking up the option metadata. The reduced page count
 * is then always derived as `ceil(pageCount / 2)`.
 */

import { prisma } from "../services/prisma.js";

export async function deriveHalfPageFromSelectedSpecs(
    productId: string,
    specifications: Record<string, unknown> | null | undefined
): Promise<boolean> {
    if (!specifications || typeof specifications !== "object") return false;
    if (Object.keys(specifications).length === 0) return false;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true },
    });
    if (!product?.categoryId) return false;

    const categorySpecs = await prisma.categorySpecification.findMany({
        where: { categoryId: product.categoryId },
        include: { options: true },
    });

    for (const [slug, value] of Object.entries(specifications)) {
        const spec = categorySpecs.find((s) => s.slug === slug);
        if (!spec) continue;
        const option = spec.options.find((o) => o.value === String(value));
        const optionMetadata = option?.metadata as { isHalfPage?: boolean } | null | undefined;
        if (optionMetadata?.isHalfPage === true) return true;
    }
    return false;
}
