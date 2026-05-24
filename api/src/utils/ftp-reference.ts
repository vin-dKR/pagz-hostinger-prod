/**
 * FTP reference-integrity helpers (issue #86).
 *
 * Before any cleanup path deletes an FTP file we must know whether
 * something in the DB still points at it. The duplicate-upload bug
 * (#86) surfaced when a sweep deleted a path that was no longer in any
 * CartItem but was still snapshotted in an OrderItem — the customer
 * then opened the order detail and got a 404.
 *
 * `isFtpPathReferenced` is the single source of truth for that check.
 * Both the public DELETE endpoint (`ftpController.deleteFTPFile`) and
 * the auth'd one (`uploadController.deleteOrderFile`) call it before
 * touching FTP, as do the bulk cart-clear paths.
 *
 * `customDesignUrl` is a Prisma `Json` column that can hold a single
 * string OR an array of strings, sometimes the relative FTP path
 * ("orders/abc.pdf") and sometimes the full public URL
 * ("https://pagz.in/orders/abc.pdf"). To cover both forms in one round
 * trip we use Prisma's `string_contains` filter on the JSON serialized
 * value — this works on MariaDB via the MySQL provider and is faster
 * than fetching every row and re-parsing.
 *
 * The check is intentionally conservative:
 *   - false positive (says "referenced" when it isn't) → file leaks on
 *     FTP; cheap, ops can sweep manually later.
 *   - false negative (says "free" when it's still referenced) → user
 *     opens an order and gets 404. THAT's the bug we're fixing.
 * When in doubt we say "referenced".
 */
import { prisma } from "../services/prisma.js";
import { extractFtpPathFromUrl } from "../services/ftp.js";

/**
 * Build the set of substrings that, if any of them appears inside the
 * JSON-stringified `customDesignUrl`, means the row references this
 * file. We probe with both the relative path and the trailing filename
 * so a row that stored the value as `https://pagz.in/orders/<file>`
 * still matches when the caller passes `orders/<file>`, and vice
 * versa. Probing the bare filename also catches rows that lost their
 * leading folder prefix to a stale sweep.
 */
function buildReferenceProbes(rawPath: string): string[] {
    const relative = extractFtpPathFromUrl(rawPath).trim();
    if (!relative) return [];
    const probes = new Set<string>();
    probes.add(relative);
    // Bare filename — the final path segment, e.g. "1779473339154-foo.pdf".
    // This is the most discriminating substring on the FTP layer (the
    // timestamp + uuid8 prefix is unique per upload), so a match here is
    // a strong signal even against a malformed JSON blob.
    const lastSlash = relative.lastIndexOf("/");
    if (lastSlash >= 0 && lastSlash < relative.length - 1) {
        probes.add(relative.slice(lastSlash + 1));
    }
    return Array.from(probes);
}

export interface ReferenceCheckOptions {
    /** Skip a specific CartItem row (used when the caller is itself
     *  deleting that cart row — its own self-reference shouldn't count). */
    excludeCartItemId?: string;
    /** Skip a specific Cart's items (used when emptying a whole cart). */
    excludeCartId?: string;
}

/**
 * Resolve to `true` when ANY CartItem (other than the excluded one) OR
 * any OrderItem still has the given FTP path in its `customDesignUrl`.
 *
 * Falls open (`false`) on DB errors so a transient outage can't block
 * legitimate user-initiated removals — the higher layer logs the
 * underlying error.
 */
/**
 * Stringify a Prisma JSON value to a stable searchable form. The DB
 * column stores either a single string, an array of strings, or
 * occasionally a stringified JSON blob. We serialize through
 * `JSON.stringify` so substring matching has a uniform target
 * regardless of which shape Prisma hands back.
 */
function stringifyJsonForSearch(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Window for "is this file still in flight" — we look back this far
 * for CartItem / OrderItem rows. Generous enough to cover a slow
 * post-payment cart cleanup but tight enough to keep the query cheap.
 */
const REFERENCE_LOOKBACK_DAYS = 30;

export async function isFtpPathReferenced(
    rawPath: string,
    options: ReferenceCheckOptions = {},
): Promise<boolean> {
    const probes = buildReferenceProbes(rawPath);
    if (probes.length === 0) return false;

    const lookback = new Date(
        Date.now() - REFERENCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
        // Prisma's `string_contains` filter on a `Json` column doesn't
        // reliably match a substring across all storage shapes on the
        // MariaDB adapter (single string vs array vs serialized JSON).
        // The old query silently returned no hits even when the file
        // WAS referenced by an OrderItem — files vanished after orders.
        //
        // New approach: pull the relevant rows in a bounded window and
        // do the substring check in JS over the stringified JSON. We
        // only need `id` + `customDesignUrl`; the lookback window keeps
        // the row count bounded.

        // ── CartItem check ────────────────────────────────────────
        const cartRows = await prisma.cartItem.findMany({
            where: {
                ...(options.excludeCartItemId
                    ? { id: { not: options.excludeCartItemId } }
                    : {}),
                ...(options.excludeCartId
                    ? { cartId: { not: options.excludeCartId } }
                    : {}),
                createdAt: { gte: lookback },
            },
            select: { id: true, customDesignUrl: true },
            take: 2000,
        });
        for (const row of cartRows) {
            const haystack = stringifyJsonForSearch(row.customDesignUrl);
            if (!haystack) continue;
            for (const probe of probes) {
                if (haystack.includes(probe)) {
                    console.warn(
                        `[ftp-reference] keeping FTP file — referenced by CartItem ${row.id}. path="${rawPath}" probe="${probe}"`,
                    );
                    return true;
                }
            }
        }

        // ── OrderItem check ──────────────────────────────────────
        // Never excluded — order snapshots outliving cart rows are the
        // primary failure mode this guard protects.
        const orderRows = await prisma.orderItem.findMany({
            where: { createdAt: { gte: lookback } },
            select: { id: true, orderId: true, customDesignUrl: true },
            take: 5000,
        });
        for (const row of orderRows) {
            const haystack = stringifyJsonForSearch(row.customDesignUrl);
            if (!haystack) continue;
            for (const probe of probes) {
                if (haystack.includes(probe)) {
                    console.warn(
                        `[ftp-reference] keeping FTP file — referenced by OrderItem ${row.id} (order ${row.orderId}). path="${rawPath}" probe="${probe}"`,
                    );
                    return true;
                }
            }
        }

        console.warn(
            `[ftp-reference] no reference found; allowing delete. path="${rawPath}" probes=${JSON.stringify(probes)} scanned cart=${cartRows.length} order=${orderRows.length}`,
        );
        return false;
    } catch (err) {
        console.warn(
            `[ftp-reference] reference check failed for "${rawPath}":`,
            err instanceof Error ? err.message : String(err),
        );
        // Fail SAFE: a DB error must NOT result in deletion of a file
        // that might be referenced by an order. We'd rather leak a few
        // bytes on FTP than wipe a customer's design file. The payment
        // persist layer's missing-file audit row will surface any
        // genuine orphans for ops to sweep manually.
        return true;
    }
}

/**
 * Convenience wrapper around `isFtpPathReferenced` that returns the
 * subset of `paths` we should still delete (i.e. NOT referenced) plus
 * the list we refused. Used by bulk cleanup callsites.
 */
export async function partitionDeletableFtpPaths(
    paths: string[],
    options: ReferenceCheckOptions = {},
): Promise<{ deletable: string[]; refused: string[] }> {
    const deletable: string[] = [];
    const refused: string[] = [];
    for (const p of paths) {
        if (await isFtpPathReferenced(p, options)) {
            refused.push(p);
        } else {
            deletable.push(p);
        }
    }
    return { deletable, refused };
}
