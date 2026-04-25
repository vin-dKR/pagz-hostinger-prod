/**
 * Addon pricing utilities.
 *
 * Single source of truth for how a CategoryPricingRule of type ADDON contributes
 * to a line item's total. Used by cart, order, and payment controllers so
 * the price a customer sees in the cart matches the price the server charges
 * at checkout and the price printed on invoices.
 *
 * An addon "applies" to a line when:
 *   - its rule is active
 *   - any configured page range (minQuantity/maxQuantity, interpreted as
 *     effective pages) is satisfied
 *
 * Unit price resolution order:
 *   1. priceModifier (preferred, used when addon augments an existing base)
 *   2. basePrice
 *   3. 0
 *
 * Multiplier:
 *   - If quantityMultiplier is false -> 1 (flat fee per item).
 *   - If quantityMultiplier is true  -> effectivePages (when available,
 *     i.e. the item is a print job with pageCount/copies) else item.quantity.
 */
import { prisma } from "../services/prisma.js";

export interface AddonPricingRule {
    id: string;
    basePrice: unknown;
    priceModifier: unknown;
    quantityMultiplier: boolean;
    fileMultiplier?: boolean;
    minQuantity: number | null;
    maxQuantity: number | null;
    isActive?: boolean;
}

export interface AddonLineItemInput {
    quantity: number;
    addons: string[];
    metadata?:
        | {
              pageCount?: number | null;
              copies?: number | null;
              /** Half-page-reduced page count, when a "Both Sides"-style option
               *  is selected. Authoritative for addon page-range matching. */
              effectivePageCount?: number | null;
          }
        | null
        | undefined;
    /** Count of uploaded files on the cart/order item; used by fileMultiplier rules. */
    fileCount?: number;
}

const toNumber = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    // Handles string + Prisma.Decimal (has toString). Number() narrows safely.
    const n = Number(value as { toString(): string });
    return Number.isFinite(n) ? n : 0;
};

/**
 * Resolve the unit (per-multiplier) price for an addon rule.
 */
export const getAddonUnitPrice = (addon: AddonPricingRule): number => {
    if (addon.priceModifier !== null && addon.priceModifier !== undefined) {
        return toNumber(addon.priceModifier);
    }
    if (addon.basePrice !== null && addon.basePrice !== undefined) {
        return toNumber(addon.basePrice);
    }
    return 0;
};

/**
 * Derive the "effective pages" used for quantityMultiplier calculations.
 * Returns null when the line item is not a print-job (no pageCount), in which
 * case addon consumers should fall back to the cart/order quantity.
 *
 * When the line carries `metadata.effectivePageCount` (set by the cart /
 * order pipeline whenever a half-page "Both Sides" option reduces pages),
 * that value is authoritative — addon page-range matching and the
 * quantityMultiplier multiplier must use the reduced count, not the raw
 * uploaded page count, otherwise an addon configured for the reduced
 * range silently contributes zero and the order persists without the
 * addon amount the customer was just charged. The web copy of this util
 * (`web/lib/utils/addon-pricing.ts:getEffectivePages`) mirrors this logic.
 */
export const getEffectivePages = (
    metadata: AddonLineItemInput["metadata"]
): number | null => {
    const meta = metadata as
        | { pageCount?: number | null; effectivePageCount?: number | null; copies?: number | null }
        | null
        | undefined;
    const reduced = meta?.effectivePageCount ? Number(meta.effectivePageCount) : 0;
    const raw = meta?.pageCount ? Number(meta.pageCount) : 0;
    const pages = reduced > 0 ? reduced : raw;
    if (!pages || pages <= 0) return null;
    const copies = meta?.copies ? Number(meta.copies) : 1;
    const safeCopies = copies > 0 ? copies : 1;
    return pages * safeCopies;
};

/**
 * Check whether an addon's page-range gate is satisfied.
 */
export const isAddonInPageRange = (
    addon: AddonPricingRule,
    effectivePages: number | null
): boolean => {
    const hasPageRange = addon.minQuantity != null || addon.maxQuantity != null;
    if (!hasPageRange) return true;
    if (effectivePages == null) return false;
    if (addon.minQuantity != null && effectivePages < addon.minQuantity) return false;
    if (addon.maxQuantity != null && effectivePages > addon.maxQuantity) return false;
    return true;
};

/**
 * Compute the total price contribution of a single addon applied to a line
 * item (returns 0 when the addon is out-of-range).
 */
export const computeAddonLineTotal = (
    addon: AddonPricingRule,
    line: AddonLineItemInput
): number => {
    const effectivePages = getEffectivePages(line.metadata);
    if (!isAddonInPageRange(addon, effectivePages)) return 0;

    const unit = getAddonUnitPrice(addon);

    // fileMultiplier wins when both flags are on — it's a more specific signal.
    if (addon.fileMultiplier) {
        const files = Math.max(1, line.fileCount ?? 0);
        return unit * files;
    }

    if (!addon.quantityMultiplier) return unit;

    const multiplier = effectivePages ?? line.quantity;
    return unit * multiplier;
};

/**
 * Compute the total addon cost for a single line item given a lookup map
 * of addon rules keyed by id.
 */
export const computeLineAddonsTotal = (
    line: AddonLineItemInput,
    addonMap: Map<string, AddonPricingRule>
): number => {
    if (!line.addons || line.addons.length === 0) return 0;
    let total = 0;
    for (const addonId of line.addons) {
        const rule = addonMap.get(addonId);
        if (!rule) continue;
        total += computeAddonLineTotal(rule, line);
    }
    return total;
};

/**
 * Sum addon contributions across many line items.
 */
export const computeAddonsSubtotal = (
    lines: AddonLineItemInput[],
    addonMap: Map<string, AddonPricingRule>
): number => {
    let total = 0;
    for (const line of lines) {
        total += computeLineAddonsTotal(line, addonMap);
    }
    return total;
};

/**
 * Collect unique, non-empty addon ids from line items.
 */
export const collectAddonIds = (lines: AddonLineItemInput[]): string[] => {
    const seen = new Set<string>();
    for (const line of lines) {
        if (!line.addons) continue;
        for (const id of line.addons) {
            if (typeof id === "string" && id.trim().length > 0) seen.add(id);
        }
    }
    return Array.from(seen);
};

/**
 * Fetch active addon pricing rules for a set of ids and return a lookup map.
 * Returns an empty map when no ids are supplied (skips the DB roundtrip).
 */
export const fetchAddonRuleMap = async (
    addonIds: string[]
): Promise<Map<string, AddonPricingRule>> => {
    if (addonIds.length === 0) return new Map();
    const rules = await prisma.categoryPricingRule.findMany({
        where: {
            id: { in: addonIds },
            ruleType: "ADDON",
            isActive: true,
        },
    });
    return new Map(
        rules.map((rule) => [
            rule.id,
            {
                id: rule.id,
                basePrice: rule.basePrice,
                priceModifier: rule.priceModifier,
                quantityMultiplier: rule.quantityMultiplier,
                fileMultiplier: (rule as { fileMultiplier?: boolean }).fileMultiplier ?? false,
                minQuantity: rule.minQuantity,
                maxQuantity: rule.maxQuantity,
                isActive: rule.isActive,
            } satisfies AddonPricingRule,
        ])
    );
};

/**
 * Convenience: normalize any user-supplied addons list to a deduped, trimmed
 * array of non-empty strings.
 */
export const normalizeAddonIds = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    for (const id of raw) {
        if (typeof id === "string" && id.trim().length > 0) seen.add(id.trim());
    }
    return Array.from(seen);
};
