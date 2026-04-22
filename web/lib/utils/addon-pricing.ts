/**
 * Client-side addon pricing helpers.
 *
 * Mirrors the server-side rules in `api/src/utils/addon-pricing.ts` so the
 * optimistic numbers we render in the cart, order review, and invoices match
 * whatever the server ultimately charges.
 *
 * When the backend has already returned a `pricing` object (see cartController
 * getCart) we always prefer it and skip the local derivation entirely — this
 * keeps the UI and the order total in lockstep even if the addon rules change
 * between cart save and checkout.
 */
import type { AddonRule, CartItem } from "@/lib/api/cart";

const toNumber = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/** Resolve the unit price for an addon (priceModifier -> basePrice -> 0). */
export const getAddonUnitPrice = (addon: AddonRule): number => {
    if (addon.priceModifier !== null && addon.priceModifier !== undefined) {
        return toNumber(addon.priceModifier);
    }
    if (addon.basePrice !== null && addon.basePrice !== undefined) {
        return toNumber(addon.basePrice);
    }
    return 0;
};

/** Effective page count used as the multiplier for quantityMultiplier addons. */
export const getEffectivePages = (metadata: CartItem["metadata"]): number | null => {
    const pageCount = metadata?.pageCount ? Number(metadata.pageCount) : 0;
    if (!pageCount || pageCount <= 0) return null;
    const copies = metadata?.copies ? Number(metadata.copies) : 1;
    return pageCount * (copies > 0 ? copies : 1);
};

/** Whether an addon's configured page range is satisfied. */
export const isAddonInPageRange = (
    addon: AddonRule,
    effectivePages: number | null
): boolean => {
    const hasPageRange = addon.minQuantity != null || addon.maxQuantity != null;
    if (!hasPageRange) return true;
    if (effectivePages == null) return false;
    if (addon.minQuantity != null && effectivePages < addon.minQuantity) return false;
    if (addon.maxQuantity != null && effectivePages > addon.maxQuantity) return false;
    return true;
};

/** Price contribution of a single addon applied to a line item. */
export const computeAddonLineTotal = (
    addon: AddonRule,
    line: { quantity: number; metadata: CartItem["metadata"] }
): number => {
    const effectivePages = getEffectivePages(line.metadata);
    if (!isAddonInPageRange(addon, effectivePages)) return 0;
    const unit = getAddonUnitPrice(addon);
    if (!addon.quantityMultiplier) return unit;
    const multiplier = effectivePages ?? line.quantity;
    return unit * multiplier;
};

/**
 * Derive the base + addon + total price for a cart item.
 *
 * Tries, in order:
 *   1. the server-authoritative `pricing` object (cart GET response)
 *   2. the stored metadata.priceBreakdown written at add-to-cart time
 *   3. a purely client-side calculation from product + addons
 */
export const derivePriceBreakdown = (
    item: CartItem
): { baseTotal: number; addonTotal: number; total: number } => {
    const pricing = (item as any).pricing;
    if (pricing) {
        return {
            baseTotal: toNumber(pricing.baseTotal),
            addonTotal: toNumber(pricing.addonTotal),
            total: toNumber(pricing.total),
        };
    }

    if (item.metadata?.priceBreakdown && Array.isArray(item.metadata.priceBreakdown)) {
        const breakdown = item.metadata.priceBreakdown;
        // Server writes labels like "Base Price (3 pages × 1 copies)" and
        // "Addon: binding". Match by prefix (case-insensitive) so the split
        // between base and addon lines survives label tweaks.
        const isAddon = (label: unknown) =>
            typeof label === "string" && label.trim().toLowerCase().startsWith("addon");
        const isBase = (label: unknown) =>
            typeof label === "string" && label.trim().toLowerCase().startsWith("base");

        const base = breakdown
            .filter((x) => isBase(x.label) && typeof x.value === "number")
            .reduce((sum, x) => sum + toNumber(x.value), 0);
        const addonTotal = breakdown
            .filter((x) => isAddon(x.label) && typeof x.value === "number")
            .reduce((sum, x) => sum + toNumber(x.value), 0);
        return {
            baseTotal: toNumber(base),
            addonTotal: toNumber(addonTotal),
            total: toNumber(base) + toNumber(addonTotal),
        };
    }

    // Pure client fallback — no breakdown and no server pricing.
    const basePrice = toNumber(item.product?.sellingPrice ?? item.product?.basePrice);
    const variantMod = toNumber(item.variant?.priceModifier);
    const baseTotal = (basePrice + variantMod) * item.quantity;

    const addonTotal = (item.addons ?? []).reduce(
        (sum, addon) =>
            sum + computeAddonLineTotal(addon, { quantity: item.quantity, metadata: item.metadata }),
        0
    );

    return { baseTotal, addonTotal, total: baseTotal + addonTotal };
};

/**
 * Human-readable label for an addon, derived from its specificationValues.
 * Falls back to "Addon #N" when the backend didn't include spec values.
 */
export const getAddonLabel = (addon: AddonRule, index: number): string => {
    const specValues = (addon.specificationValues ?? {}) as Record<string, unknown>;
    const entries = Object.entries(specValues);
    if (entries.length === 0) return `Addon #${index + 1}`;
    return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
};
