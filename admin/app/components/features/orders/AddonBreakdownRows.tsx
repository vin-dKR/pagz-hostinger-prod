/**
 * AddonBreakdownRows (admin port)
 *
 * Renders the per-file sub-rows of a `perFileEvaluation` addon entry in
 * the order detail view. Mirrors `web/app/components/AddonBreakdownRows.tsx`
 * so the customer-visible cart breakdown and the admin-visible order
 * breakdown stay layout-compatible:
 *
 *   Spiral Binding (Pages: 200-600)              ₹100.00
 *     design.pdf (500p)                           ₹50.00
 *     specs.pdf (241p)                            ₹50.00
 *
 * Filtering rules match the storefront primitive:
 *   - Entries with `price <= 0` are hidden (file outside this rule's tier).
 *   - When 0 or 1 priced entries remain, return null so the parent total
 *     conveys the answer without redundant sub-rows.
 */
import { getFilenameFromPath } from '@/lib/utils/fileUrl';
import { formatCurrency } from '@/lib/utils/format';
import type { AddonBreakdownEntry } from '@/lib/api/orders.service';

interface AddonBreakdownRowsProps {
    breakdown: AddonBreakdownEntry[];
    /** Resolve a file URL to a human-readable name. Falls back to the URL
     *  basename via `getFilenameFromPath`. */
    resolveFilename?: (fileUrl: string) => string | undefined;
    /** Optional className for the wrapper `<ul>`. */
    className?: string;
}

const safeFilename = (
    url: string,
    resolveFilename?: (u: string) => string | undefined,
): string => {
    if (resolveFilename) {
        const resolved = resolveFilename(url);
        if (resolved && resolved.trim()) return resolved;
    }
    const basename = getFilenameFromPath(url);
    return basename && basename.trim() ? basename : url;
};

export function AddonBreakdownRows({
    breakdown,
    resolveFilename,
    className,
}: AddonBreakdownRowsProps) {
    if (!breakdown || breakdown.length <= 1) return null;

    // Hide ₹0 entries — files outside this rule's range tier add noise,
    // not signal. Identical filter to the storefront primitive.
    const visible = breakdown.filter((e) => e.fileUrl && Number(e.price || 0) > 0);
    if (visible.length <= 1) return null; // 0 or 1 priced → parent row covers it

    return (
        <ul className={className ?? 'mt-1 space-y-0.5'}>
            {visible.map((entry, idx) => {
                if (!entry.fileUrl) return null;
                const name = safeFilename(entry.fileUrl, resolveFilename);
                const pageHint = entry.pageCount > 0 ? ` (${entry.pageCount}p)` : '';
                return (
                    <li
                        key={`${entry.fileUrl}-${idx}`}
                        className="flex items-center justify-between pl-4 text-[11px] text-[var(--color-foreground-secondary)]"
                    >
                        <span className="truncate min-w-0 mr-2" title={name}>
                            <span className="text-[var(--color-foreground-tertiary)]">└</span>{' '}
                            <span className="text-[var(--color-foreground)]">{name}</span>
                            <span className="text-[var(--color-foreground-tertiary)]">{pageHint}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-[var(--color-foreground)]">
                            {formatCurrency(entry.price)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export default AddonBreakdownRows;
