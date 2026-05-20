/**
 * AddonBreakdownRows — Phase 3 of per-file addon pricing.
 *
 * Spec: `prompts/per-file-addon-pricing-architecture.md` §2 Phase 3, §3.3.
 *
 * Single rendering primitive for the per-file addon breakdown surfaced by
 * the api (`AddonBreakdownEntry`). Used by the services page price card,
 * cart row, checkout review and guest cart so a user sees the exact same
 * sub-row layout end-to-end.
 *
 *   Spiral Binding (Pages: 200-600)              ₹100.00
 *     design.pdf (500p)                           ₹50.00
 *     specs.pdf (241p)                            ₹50.00
 *
 * Only renders when `breakdown.length > 1` (perFileEvaluation rules with
 * 2+ files). A single-entry breakdown collapses back to the parent row —
 * the aggregate price already conveys all the info the user needs.
 */
import { getFilenameFromS3Key } from "@/lib/utils/s3";
import type { AddonBreakdownEntry } from "@/lib/api/cart";

interface AddonBreakdownRowsProps {
    breakdown: AddonBreakdownEntry[];
    /** Optional filename lookup keyed by FTP/S3 url. Pass the in-flight
     *  upload state from the services page so unsaved-yet uploads still
     *  display their human-readable name. Falls back to the URL basename
     *  when the lookup misses or no resolver is supplied. */
    resolveFilename?: (fileUrl: string) => string | undefined;
    /** Optional className for the wrapper `<ul>` so callers can tighten
     *  spacing within their parent layout. */
    className?: string;
    /** Currency prefix; defaults to `₹` to match the rest of the UI. */
    currency?: string;
    /** Visual variant. `compact` is the dense cart/checkout style; `card`
     *  is the price-card-friendly variant with slightly larger text +
     *  divider colour. Defaults to `compact`. */
    variant?: "compact" | "card";
}

const safeFilename = (url: string, resolveFilename?: (u: string) => string | undefined): string => {
    if (resolveFilename) {
        const resolved = resolveFilename(url);
        if (resolved && resolved.trim()) return resolved;
    }
    const basename = getFilenameFromS3Key(url);
    return basename && basename.trim() ? basename : url;
};

const fmtPrice = (value: number, currency: string): string =>
    `${currency}${Number(value || 0).toFixed(2)}`;

export function AddonBreakdownRows({
    breakdown,
    resolveFilename,
    className,
    currency = "₹",
    variant = "compact",
}: AddonBreakdownRowsProps) {
    // Aggregate fallback (one entry, `fileUrl: null`) collapses back to
    // the parent row — no sub-rows to render.
    if (!breakdown || breakdown.length <= 1) return null;

    // Hide entries that scored ₹0 — those are files outside this rule's
    // range tier. Showing them adds noise (e.g. two binding tiers each
    // matching a different file but rendering the other one at ₹0 makes
    // the UI look broken even though the math is correct).
    const visible = breakdown.filter((e) => e.fileUrl && Number(e.price || 0) > 0);
    if (visible.length === 0) return null;
    if (visible.length === 1) return null; // single-priced file already shown in parent total

    const baseRowCls =
        variant === "card"
            ? "flex justify-between items-center text-[11px] text-gray-600 pl-4"
            : "flex justify-between items-center text-[10.5px] text-gray-500 pl-4";

    return (
        <ul
            className={
                className ??
                (variant === "card"
                    ? "mt-1 space-y-0.5"
                    : "mt-0.5 space-y-0.5")
            }
        >
            {visible.map((entry, idx) => {
                if (!entry.fileUrl) return null;
                const name = safeFilename(entry.fileUrl, resolveFilename);
                const pageHint = entry.pageCount > 0
                    ? ` (${entry.pageCount}p)`
                    : "";
                return (
                    <li
                        key={`${entry.fileUrl}-${idx}`}
                        className={baseRowCls}
                    >
                        <span className="truncate min-w-0 mr-2" title={name}>
                            <span className="text-gray-400">└</span>{" "}
                            <span className="text-gray-700">{name}</span>
                            <span className="text-gray-400">{pageHint}</span>
                        </span>
                        <span className="font-medium text-gray-700 shrink-0 tabular-nums">
                            {fmtPrice(entry.price, currency)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export default AddonBreakdownRows;
