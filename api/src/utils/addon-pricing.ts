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
    /** Phase 2: evaluate the addon separately for each uploaded file
     *  (using its own pageCount), then sum the per-file results. The
     *  other multiplier flags (`fileMultiplier`, `copyMultiplier`,
     *  `quantityMultiplier`) still apply *inside* the per-file branch
     *  but operate on a single-file subline. Use for per-book
     *  bindings on multi-PDF orders where each file becomes its own
     *  physical artefact.
     *
     *  Back-compat: when the flag is unset (default false), the
     *  engine takes its existing aggregate path. When set but the
     *  line has no `metadata.files`, the engine ALSO falls back to
     *  aggregate and logs a warning so prod surfaces stale rows. */
    perFileEvaluation?: boolean;
    minQuantity: number | null;
    maxQuantity: number | null;
    isActive?: boolean;
}

/**
 * Per-uploaded-file metadata captured at add-to-cart time. Persisted on
 * `CartItem.metadata.files` and copied through to `OrderItem.metadata.files`.
 *
 * Phase 0 only writes / propagates this — the engine continues to read
 * aggregate `pageCount` / `effectivePageCount`. Phase 2 will add the
 * per-file evaluation branch that consumes this array.
 *
 * `url` matches the corresponding entry in `customDesignUrl` (relative FTP
 * path). Engine cross-checks on mismatch and falls back to aggregate.
 */
export interface PricingFileMeta {
    url: string;
    pageCount: number;
}

/**
 * Shape of `CartItem.metadata` / `OrderItem.metadata` as consumed by the
 * pricing engine. Intentionally a superset of the fields the engine reads
 * today — `files` is additive and optional. Old rows without `files` keep
 * working: the engine falls through to the aggregate `pageCount` path.
 */
export interface PricingLineMetadata {
    pageCount?: number | null;
    copies?: number | null;
    /** Half-page-reduced page count, when a "Both Sides"-style option
     *  is selected. Authoritative for addon page-range matching. */
    effectivePageCount?: number | null;
    /** NEW (Phase 0). Per-file `{ url, pageCount }` array. Optional —
     *  rows written before Phase 0 lack this and the engine falls back
     *  to the aggregate path. */
    files?: PricingFileMeta[];
    /** Side spec applied to the line, used by Phase 2 per-file
     *  evaluation to recompute each file's effective page count.
     *  When omitted the engine falls back to "no half-page" for the
     *  subline (consistent with existing aggregate path). */
    side?: "one" | "both";
}

export interface AddonLineItemInput {
    quantity: number;
    addons: string[];
    metadata?: PricingLineMetadata | null | undefined;
    /** Count of uploaded files on the cart/order item; used by fileMultiplier rules. */
    fileCount?: number;
}

/**
 * Validate + normalize an untrusted `metadata.files` input into a clean
 * `PricingFileMeta[]`. Returns `undefined` when the input is missing,
 * empty, or contains no recognisable entries — callers can spread the
 * result conditionally so we never persist an empty array.
 *
 * Drops entries that:
 *   - aren't objects with a string `url` of non-zero length, or
 *   - have a non-finite / negative `pageCount`.
 *
 * Page counts are floored to non-negative integers; `url` is trimmed.
 * Caps the array at 100 entries — paranoid bound against malformed input
 * (a single cart line will never legitimately reference more files).
 */
export const sanitizePricingFiles = (
    raw: unknown,
): PricingFileMeta[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const MAX_FILES = 100;
    const out: PricingFileMeta[] = [];
    for (const entry of raw.slice(0, MAX_FILES)) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as { url?: unknown; pageCount?: unknown };
        const url = typeof e.url === "string" ? e.url.trim() : "";
        if (!url) continue;
        const pageCountNum = Number(e.pageCount);
        const pageCount = Number.isFinite(pageCountNum) && pageCountNum >= 0
            ? Math.floor(pageCountNum)
            : 0;
        out.push({ url, pageCount });
    }
    return out.length > 0 ? out : undefined;
};

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
 * Per-file effective page count for a given side spec.
 *
 * Pure: (rawPages, side) -> reducedPages. Mirrors the half-page reduction
 * applied to aggregate metadata by `processHalfPageCalculation`
 * (`api/src/utils/half-page-calculation.ts`) — kept in sync so a single
 * file evaluated through this helper produces the same effective count
 * the aggregate path would produce for the same raw input.
 *
 * Used by `deriveFileSubline` in the `perFileEvaluation` branch. Exposed
 * so Phase 3 UI breakdown rendering can show the same numbers without
 * importing the controller-side helper.
 */
export const halfPageReduce = (
    rawPages: number,
    side: "one" | "both" | undefined
): number => {
    if (!Number.isFinite(rawPages) || rawPages <= 0) return 0;
    return side === "both" ? Math.ceil(rawPages / 2) : Math.floor(rawPages);
};

/**
 * Build a per-file subline metadata from a parent line + one file.
 *
 * Used internally by `computeAddonLineTotal`'s perFileEvaluation branch.
 * Exposed for UI breakdown rendering (Phase 3).
 *
 *   - `pageCount`           = the file's own raw pageCount
 *   - `effectivePageCount`  = re-derived from the file's pageCount + parent
 *                             `side` spec (half-page reduce when side='both').
 *                             Falls back to undefined when no side info is
 *                             available, so the engine's downstream effective-
 *                             page lookup transparently reverts to the raw
 *                             count (same behaviour as legacy aggregate rows).
 *   - `copies`              = parent.copies (unchanged — copies multiply each
 *                             file equally; the per-file branch doesn't
 *                             distribute copies across files).
 *   - `side`                = parent.side (carried forward for any nested
 *                             consumer that re-reads it).
 *   - `files`               = OMITTED. The subline represents a single file
 *                             and must not re-trigger the per-file branch.
 */
export const deriveFileSubline = (
    parent: PricingLineMetadata,
    file: PricingFileMeta
): PricingLineMetadata => {
    const rawPages = Number.isFinite(file.pageCount) && file.pageCount > 0
        ? Math.floor(file.pageCount)
        : 0;
    const reduced = parent.side ? halfPageReduce(rawPages, parent.side) : 0;
    const subline: PricingLineMetadata = {
        pageCount: rawPages > 0 ? rawPages : null,
        copies: parent.copies ?? null,
    };
    if (reduced > 0 && reduced !== rawPages) {
        subline.effectivePageCount = reduced;
    }
    if (parent.side) subline.side = parent.side;
    return subline;
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
 *   - perFileEvaluation           -> recurse with each file as a virtual
 *                                    subline (fileCount=1, perFileEvaluation
 *                                    cleared on the inner rule); sum the
 *                                    per-file results. Falls back to the
 *                                    aggregate path when the line has no
 *                                    `metadata.files` (logs a warning).
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
    // ── Phase 2: per-file evaluation branch ──────────────────────────────
    // Recurses depth-1: the inner call clears `perFileEvaluation` so we
    // can't loop. Each file becomes a virtual subline with its own
    // pageCount + re-derived effective pages (half-page reduced when
    // side='both'). Multipliers inside the branch (`copyMultiplier`,
    // `fileMultiplier`, `quantityMultiplier`) keep their normal
    // semantics but operate on the single-file subline:
    //   - fileMultiplier becomes degenerate (1 file per subline) — by
    //     design, since perFileEvaluation already iterates files.
    //   - copyMultiplier × N copies still multiplies per file, matching
    //     "one binding per book × N copies".
    //   - quantityMultiplier × per-file pages, summed across files —
    //     equivalent to charging per page across the whole job for
    //     non-tiered rules; the win is range-gating each file
    //     independently when ranges are set.
    if (addon.perFileEvaluation) {
        const files = line.metadata?.files;
        if (files && files.length > 0) {
            const parentMeta = line.metadata as PricingLineMetadata;
            // Recurse with perFileEvaluation cleared — depth-1, no infinite
            // recursion risk. Each subline carries its own pageCount +
            // effective pages derived from the parent's side spec.
            const innerRule: AddonPricingRule = { ...addon, perFileEvaluation: false };
            let total = 0;
            for (const file of files) {
                const sublineMeta = deriveFileSubline(parentMeta, file);
                total += computeAddonLineTotal(innerRule, {
                    quantity: line.quantity,
                    addons: line.addons,
                    metadata: sublineMeta,
                    fileCount: 1,
                });
            }
            return total;
        }
        // Back-compat: rule has the flag but the line predates Phase 0
        // (no metadata.files persisted). Fall through to the aggregate
        // path and surface the row to ops.
        console.warn(
            "[pricing] perFileEvaluation rule applied to line without files; falling back to aggregate",
            { addonId: addon.id }
        );
    }

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
 * Filter addon rules through the spec-group dominance rule.
 *
 * Precedence (highest dominance wins; rules below are suppressed within
 * the same spec group):
 *
 *   perFileEvaluation  >  copyMultiplier  >  fileMultiplier  >  others
 *
 *   - Group rules by spec values (binding=Spiral, paper=A4, ...).
 *   - If ANY rule in a group has perFileEvaluation=true, every other
 *     rule in the same group is suppressed EXCEPT other
 *     perFileEvaluation rules and fileMultiplier rules. The per-file
 *     branch evaluates the addon once per uploaded file using each
 *     file's own pageCount — a stale aggregate-tier rule
 *     (e.g. "Spiral 1000-1500 pages flat") would double-charge on top
 *     of it. fileMultiplier rules are exempt: they gate on file count,
 *     not pages, so the two are orthogonal.
 *   - If ANY rule in a group has copyMultiplier=true and no
 *     perFileEvaluation rule is present, every other rule in the same
 *     group is suppressed EXCEPT fileMultiplier rules. Same-spec
 *     total-page tiers (e.g. "Spiral 51-100 pages" alongside
 *     "Spiral 1-50 pages × copies") thus never both fire — the
 *     per-copy semantics win and the total-page tier drops out cleanly.
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
        const hasPerFileDominant = group.some((g) => g.rule.perFileEvaluation);
        const hasCopyDominant = group.some((g) => g.rule.copyMultiplier);
        for (const { rule } of group) {
            if (hasPerFileDominant && !rule.perFileEvaluation && !rule.fileMultiplier) {
                // Suppressed: same-spec aggregate-tier rule that would
                // double-charge alongside the per-file branch. fileMultiplier
                // rules survive because they gate on file count, not pages.
                continue;
            }
            if (
                !hasPerFileDominant
                && hasCopyDominant
                && !rule.copyMultiplier
                && !rule.fileMultiplier
            ) {
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
 * Per-file breakdown for UI rendering (Phase 3 consumer).
 *
 * Returns one entry per uploaded file when `perFileEvaluation` is on
 * and the line has `metadata.files`; otherwise returns one synthetic
 * "aggregate" entry (`fileUrl: null`) reflecting the engine's existing
 * aggregate path. Callers can render the array directly without
 * branching on the rule shape.
 */
export interface AddonBreakdownEntry {
    /** Relative FTP url for the file this entry priced. `null` for the
     *  aggregate fallback (legacy rows, or rules without perFileEvaluation). */
    fileUrl: string | null;
    /** Raw pages used for this entry (per-file in the per-file branch;
     *  aggregate `pageCount` in the fallback path). */
    pageCount: number;
    /** Post half-page reduction. Mirrors `pageCount` when no half-page
     *  applied. */
    effectivePages: number;
    /** Price contribution of this entry (already rounded to 2dp). */
    price: number;
}

export const computeAddonBreakdown = (
    addon: AddonPricingRule,
    line: AddonLineItemInput
): AddonBreakdownEntry[] => {
    const files = line.metadata?.files;
    // Per-file branch: one entry per file, priced by recursing the
    // engine with perFileEvaluation cleared (same depth-1 trick as
    // computeAddonLineTotal so behaviour stays in lock-step).
    if (addon.perFileEvaluation && files && files.length > 0) {
        const parentMeta = line.metadata as PricingLineMetadata;
        const innerRule: AddonPricingRule = { ...addon, perFileEvaluation: false };
        const entries: AddonBreakdownEntry[] = [];
        for (const file of files) {
            const sublineMeta = deriveFileSubline(parentMeta, file);
            const price = computeAddonLineTotal(innerRule, {
                quantity: line.quantity,
                addons: line.addons,
                metadata: sublineMeta,
                fileCount: 1,
            });
            const rawPages = sublineMeta.pageCount ?? 0;
            const effective = sublineMeta.effectivePageCount ?? rawPages;
            entries.push({
                fileUrl: file.url,
                pageCount: rawPages,
                effectivePages: effective,
                price: Number(price.toFixed(2)),
            });
        }
        return entries;
    }

    // Aggregate fallback: one synthetic entry. Mirrors the engine's
    // aggregate-path math so totals line up exactly.
    const price = computeAddonLineTotal(addon, line);
    const rawPages = Number(line.metadata?.pageCount ?? 0) || 0;
    const reduced = Number(line.metadata?.effectivePageCount ?? 0) || 0;
    const effective = reduced > 0 ? reduced : rawPages;
    return [
        {
            fileUrl: null,
            pageCount: rawPages,
            effectivePages: effective,
            price: Number(price.toFixed(2)),
        },
    ];
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
                perFileEvaluation: (rule as { perFileEvaluation?: boolean }).perFileEvaluation ?? false,
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

/**
 * UI-friendly per-addon detail row returned by `buildAddonLineDetails`.
 *
 * Shape mirrors the cart endpoint's `CartItemAddonPricing` so storefront
 * and admin can share rendering primitives (e.g. `AddonBreakdownRows`,
 * `buildAddonLabelMap`). The order/admin surface relies on it for
 * "actually-charged" pricing so the legacy `OrderItem.addons[].priceModifier`
 * (which is the rule's raw unit price, not the contribution to this line)
 * never has to leak into the UI again.
 */
export interface AddonLineDetail {
    ruleId: string;
    /** Pre-formatted "key: value, …" label built from the rule's
     *  `specificationValues`. Falls back to "Addon" when the rule has no
     *  spec dimensions (rare — usually flat-fee addons). */
    name: string;
    /** Final price contributed by this rule to the line (already rounded
     *  to 2dp). Zero when the rule didn't fire — callers typically filter
     *  these out before rendering. */
    total: number;
    /** Per-file breakdown from `computeAddonBreakdown` so UIs can render
     *  Phase 3 sub-rows uniformly across cart + order + admin. */
    breakdown: AddonBreakdownEntry[];
    /** Rule's page range — used by the UI to disambiguate two addons that
     *  share the same spec-derived `name` (mirrors `buildAddonLabelMap`). */
    range: { min: number | null; max: number | null };
}

/**
 * Internal: turn a rule's `specificationValues` blob into the "key: value,
 * …" label used everywhere (cart row, order review, invoice, admin item).
 */
const formatAddonName = (specificationValues: unknown): string => {
    if (!specificationValues || typeof specificationValues !== "object") return "Addon";
    const entries = Object.entries(specificationValues as Record<string, unknown>);
    if (entries.length === 0) return "Addon";
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ");
};

/**
 * Build the cart-style per-addon detail rows for a single line item.
 *
 * Applies spec-group dominance via `resolveActiveAddons`, computes each
 * surviving rule's contribution with `computeAddonLineTotal`, and packages
 * the breakdown for UI consumption. Single source of truth — used by the
 * cart controller (live preview) and the order/admin endpoints (replay
 * against persisted `OrderItem.metadata`) so all surfaces see identical
 * numbers without reimplementing the engine.
 *
 * Rules whose tier doesn't match the line (e.g. binding "201-300 pages"
 * attached to a 150-page line) compute as `total = 0`. They're still
 * returned so callers can choose to render diagnostic info if needed;
 * UI components typically filter `total > 0` before rendering.
 */
export const buildAddonLineDetails = <
    R extends AddonPricingRule & { specificationValues?: unknown }
>(
    rules: R[],
    line: AddonLineItemInput,
): AddonLineDetail[] => {
    if (rules.length === 0) return [];
    const surviving = resolveActiveAddons(
        rules.map((rule) => ({
            rule,
            specs: (rule.specificationValues as Record<string, unknown> | null) ?? null,
        }))
    );
    return surviving.map((rule) => {
        const total = computeAddonLineTotal(rule, line);
        return {
            ruleId: rule.id,
            name: formatAddonName(rule.specificationValues),
            total: Number(total.toFixed(2)),
            breakdown: computeAddonBreakdown(rule, line),
            range: {
                min: rule.minQuantity ?? null,
                max: rule.maxQuantity ?? null,
            },
        };
    });
};
