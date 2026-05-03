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
    /** Charge once per physical copy (e.g. binding — one binding per
     *  printed book). When true the addon's range and per-page math are
     *  evaluated against the *per-copy* page count (post-half-page
     *  reduction when applicable) and the final price is multiplied by
     *  the copies count. */
    copyMultiplier?: boolean;
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
 * Total sheets used for addon page-range matching + per-page multipliers.
 *
 * Returns the effective sheet count `(effectivePageCount ?? pageCount) ×
 * copies`. Half-page reduction flows in: when "Both Sides" duplexes a
 * 100-page PDF onto 50 sheets, addons gate on 50 (not 100) — binding,
 * lamination and page-numbering all relate to the *physical* sheet
 * count, not the original document length. Falls back to raw
 * `pageCount × copies` when no effective count is persisted.
 * The web mirror (`web/lib/utils/addon-pricing.ts`) keeps the same
 * formula so cart preview, server cart math, and order totals agree.
 */
export const getEffectivePages = (
    metadata: AddonLineItemInput["metadata"]
): number | null => {
    const meta = metadata as
        | { pageCount?: number | null; copies?: number | null; effectivePageCount?: number | null }
        | null
        | undefined;
    const reduced = meta?.effectivePageCount ? Number(meta.effectivePageCount) : 0;
    const pages = reduced > 0
        ? reduced
        : meta?.pageCount ? Number(meta.pageCount) : 0;
    if (!pages || pages <= 0) return null;
    const copies = meta?.copies ? Number(meta.copies) : 1;
    const safeCopies = copies > 0 ? copies : 1;
    return pages * safeCopies;
};

/** Per-copy pages used for `copyMultiplier` addons.
 *
 *  Returns the document size of a single physical book — post half-page
 *  reduction when "Both Sides" cut the sheet count. Binding-style addons
 *  bind the sheets in one book, not the total across copies, so the
 *  range and per-page math here use the reduced per-copy count. Falls
 *  back to raw `pageCount` when no half-page metadata is present, and to
 *  `null` when the line item isn't a paginated print job. */
export const getPerCopyPages = (
    metadata: AddonLineItemInput["metadata"]
): number | null => {
    const meta = metadata as
        | { pageCount?: number | null; effectivePageCount?: number | null }
        | null
        | undefined;
    const reduced = meta?.effectivePageCount ? Number(meta.effectivePageCount) : 0;
    if (reduced > 0) return reduced;
    const raw = meta?.pageCount ? Number(meta.pageCount) : 0;
    return raw > 0 ? raw : null;
};

/** Number of physical copies on a line. Falls back to 1. */
export const getCopiesCount = (
    metadata: AddonLineItemInput["metadata"]
): number => {
    const meta = metadata as { copies?: number | null } | null | undefined;
    const copies = meta?.copies ? Number(meta.copies) : 1;
    return copies > 0 ? copies : 1;
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
 *
 * Multiplier matrix (resolved in this order):
 *   - fileMultiplier              -> unit × files (more specific signal, wins).
 *   - copyMultiplier              -> range checked against per-copy pages.
 *                                    unit × (perCopyPages if also
 *                                    quantityMultiplier else 1) × copies.
 *   - quantityMultiplier          -> unit × (pageCount × copies). Existing
 *                                    behavior: addon scales with total
 *                                    document volume (e.g. page-numbering).
 *   - none                        -> flat unit price.
 */
export const computeAddonLineTotal = (
    addon: AddonPricingRule,
    line: AddonLineItemInput
): number => {
    const unit = getAddonUnitPrice(addon);

    // fileMultiplier wins when both flags are on — it's a more specific signal.
    if (addon.fileMultiplier) {
        const totalPages = getEffectivePages(line.metadata);
        if (!isAddonInPageRange(addon, totalPages)) return 0;
        const files = Math.max(1, line.fileCount ?? 0);
        return unit * files;
    }

    if (addon.copyMultiplier) {
        const perCopy = getPerCopyPages(line.metadata);
        // Range check against per-copy pages — a 250-page book × 4 copies
        // matches a "201-300 pages" binding even though total volume is
        // 1000 pages. Falls through to total-page check when the line
        // has no pagination (non-print SKU).
        if (!isAddonInPageRange(addon, perCopy ?? line.quantity)) return 0;
        const copies = getCopiesCount(line.metadata);
        const perBookMult = addon.quantityMultiplier ? (perCopy ?? 1) : 1;
        return unit * perBookMult * copies;
    }

    const totalPages = getEffectivePages(line.metadata);
    if (!isAddonInPageRange(addon, totalPages)) return 0;

    if (!addon.quantityMultiplier) return unit;

    const multiplier = totalPages ?? line.quantity;
    return unit * multiplier;
};

/** Stable key for grouping addon rules by their spec dimensions.
 *  Two rules that differ only in `minQuantity`/`maxQuantity` (i.e. tiers
 *  for the same binding/lamination/etc.) collapse to the same key. The
 *  rule's own spec values aren't on `AddonPricingRule` so we accept it
 *  via a parallel map keyed by id. */
const stableSpecKey = (specs: Record<string, unknown> | null | undefined): string => {
    if (!specs || typeof specs !== "object") return "__none__";
    const keys = Object.keys(specs).sort();
    return keys.map((k) => `${k}=${String(specs[k])}`).join("|") || "__empty__";
};

/**
 * Filter addon rules through the spec-group dominance rule:
 *   - Group rules by spec values (binding=Spiral, paper=A4, ...).
 *   - If ANY rule in a group has copyMultiplier=true, every other rule
 *     in the same group is suppressed. Same-spec total-page tiers
 *     (e.g. "Spiral 51-100 pages" alongside "Spiral 1-50 pages × copies")
 *     thus never both fire — the per-copy semantics win and the total-
 *     page tier drops out cleanly. fileMultiplier rules are exempt
 *     since they gate on file count, not pages.
 *   - Each surviving rule's own range/multiplier logic still runs in
 *     `computeAddonLineTotal`.
 */
export const resolveActiveAddons = <T extends AddonPricingRule>(
    rules: Array<{ rule: T; specs?: Record<string, unknown> | null }>
): T[] => {
    if (rules.length === 0) return [];
    const groups = new Map<string, Array<{ rule: T; specs?: Record<string, unknown> | null }>>();
    for (const entry of rules) {
        const key = stableSpecKey(entry.specs ?? null);
        const list = groups.get(key);
        if (list) list.push(entry);
        else groups.set(key, [entry]);
    }

    const surviving: T[] = [];
    for (const group of groups.values()) {
        const hasCopyDominant = group.some((g) => g.rule.copyMultiplier);
        for (const { rule } of group) {
            if (hasCopyDominant && !rule.copyMultiplier && !rule.fileMultiplier) {
                // Suppressed: same-spec, non-copy-multiplier tier built
                // for total-page ranges — would double-charge alongside
                // the per-copy variant.
                continue;
            }
            surviving.push(rule);
        }
    }
    return surviving;
};

/**
 * Compute the total addon cost for a single line item given a lookup map
 * of addon rules keyed by id. Applies spec-group dominance (see
 * `resolveActiveAddons`) so two same-spec tiered rules can't both fire
 * when one of them is `copyMultiplier`-flagged.
 */
export const computeLineAddonsTotal = (
    line: AddonLineItemInput,
    addonMap: Map<string, AddonPricingRule>,
    specsLookup?: Map<string, Record<string, unknown> | null | undefined>
): number => {
    if (!line.addons || line.addons.length === 0) return 0;
    const candidates = line.addons
        .map((id) => {
            const rule = addonMap.get(id);
            if (!rule) return null;
            return { rule, specs: specsLookup?.get(id) ?? null };
        })
        .filter((x): x is { rule: AddonPricingRule; specs: Record<string, unknown> | null } => x !== null);
    const active = resolveActiveAddons(candidates);
    let total = 0;
    for (const rule of active) {
        total += computeAddonLineTotal(rule, line);
    }
    return total;
};

/**
 * Sum addon contributions across many line items.
 */
export const computeAddonsSubtotal = (
    lines: AddonLineItemInput[],
    addonMap: Map<string, AddonPricingRule>,
    specsLookup?: Map<string, Record<string, unknown> | null | undefined>
): number => {
    let total = 0;
    for (const line of lines) {
        total += computeLineAddonsTotal(line, addonMap, specsLookup);
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
                copyMultiplier: (rule as { copyMultiplier?: boolean }).copyMultiplier ?? false,
                minQuantity: rule.minQuantity,
                maxQuantity: rule.maxQuantity,
                isActive: rule.isActive,
            } satisfies AddonPricingRule,
        ])
    );
};

/**
 * Companion to `fetchAddonRuleMap`: same query, exposes the spec values
 * keyed by rule id so callers (cart, order, payment controllers) can
 * feed them into `computeAddonsSubtotal` for spec-group dominance.
 */
export const fetchAddonSpecMap = async (
    addonIds: string[]
): Promise<Map<string, Record<string, unknown> | null>> => {
    if (addonIds.length === 0) return new Map();
    const rules = await prisma.categoryPricingRule.findMany({
        where: {
            id: { in: addonIds },
            ruleType: "ADDON",
            isActive: true,
        },
        select: { id: true, specificationValues: true },
    });
    return new Map(
        rules.map((rule) => [
            rule.id,
            (rule.specificationValues as Record<string, unknown> | null) ?? null,
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
