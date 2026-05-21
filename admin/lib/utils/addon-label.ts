/**
 * Disambiguate addon labels when two pricing tiers share the same
 * spec-derived name (e.g. two "paper-sizes: a4, binding: wiro binding"
 * rules in different page ranges). Without this, the order detail view
 * shows two identical labels with different prices and looks broken.
 *
 * Mirrors `web/lib/utils/addon-label.ts` so cart, order review, and the
 * admin order detail all dedupe addon labels the same way.
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
 * Pass the full list of priced addons for one order line so the map covers
 * them all at once.
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
