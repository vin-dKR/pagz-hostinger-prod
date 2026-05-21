/**
 * Disambiguate addon labels when two pricing tiers share the same
 * spec-derived name (e.g. two "paper-sizes: a4, binding: wiro binding"
 * rules in different page ranges). Without this, the cart breakdown
 * shows two identical labels with different prices and looks broken.
 *
 * Returns a label that includes the rule's page range when needed:
 *   "paper-sizes: a4, binding: wiro binding (301-500 pages)"
 *   "paper-sizes: a4, binding: wiro binding (1-300 pages)"
 *
 * When only one addon carries a given name, returns the name unchanged.
 */

interface AddonLike {
    name: string;
    range?: { min: number | null; max: number | null };
}

const formatRange = (range: { min: number | null; max: number | null }): string | null => {
    const { min, max } = range;
    if (min == null && max == null) return null;
    if (min != null && max != null) return `${min}-${max} pages`;
    if (min != null) return `from ${min} pages`;
    if (max != null) return `up to ${max} pages`;
    return null;
};

/**
 * Build a map: ruleId -> display label. Names that appear once stay as-is;
 * names that appear 2+ times get their range appended for disambiguation.
 *
 * Pass the full list of addons for one cart line / pricing response so the
 * map covers them all at once.
 */
export function buildAddonLabelMap<T extends AddonLike & { ruleId: string }>(
    addons: T[],
): Map<string, string> {
    const counts = new Map<string, number>();
    for (const a of addons) {
        counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
    }
    const out = new Map<string, string>();
    for (const a of addons) {
        const duplicated = (counts.get(a.name) ?? 0) > 1;
        const suffix = duplicated && a.range ? formatRange(a.range) : null;
        out.set(a.ruleId, suffix ? `${a.name} (${suffix})` : a.name);
    }
    return out;
}

/**
 * Convenience for callers with a single addon in hand. Prefer
 * `buildAddonLabelMap` when rendering multiple at once.
 */
export function formatAddonLabel(
    addon: AddonLike,
    siblings: AddonLike[],
): string {
    const duplicated = siblings.filter((s) => s.name === addon.name).length > 1;
    const suffix = duplicated && addon.range ? formatRange(addon.range) : null;
    return suffix ? `${addon.name} (${suffix})` : addon.name;
}
