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
export async function isFtpPathReferenced(
    rawPath: string,
    options: ReferenceCheckOptions = {},
): Promise<boolean> {
    const probes = buildReferenceProbes(rawPath);
    if (probes.length === 0) return false;

    try {
        for (const probe of probes) {
            // CartItem reference (excluding the caller's own row, if any).
            const cartHit = await prisma.cartItem.findFirst({
                where: {
                    customDesignUrl: { string_contains: probe },
                    ...(options.excludeCartItemId
                        ? { id: { not: options.excludeCartItemId } }
                        : {}),
                    ...(options.excludeCartId
                        ? { cartId: { not: options.excludeCartId } }
                        : {}),
                },
                select: { id: true },
            });
            if (cartHit) {
                console.warn(
                    `[ftp-reference] keeping FTP file — referenced by CartItem ${cartHit.id}. path="${rawPath}" probe="${probe}"`,
                );
                return true;
            }

            // OrderItem reference — never excluded; an order snapshot
            // outliving the cart row is the primary failure mode #86
            // targets.
            const orderHit = await prisma.orderItem.findFirst({
                where: {
                    customDesignUrl: { string_contains: probe },
                },
                select: { id: true, orderId: true },
            });
            if (orderHit) {
                console.warn(
                    `[ftp-reference] keeping FTP file — referenced by OrderItem ${orderHit.id} (order ${orderHit.orderId}). path="${rawPath}" probe="${probe}"`,
                );
                return true;
            }
        }
        console.warn(
            `[ftp-reference] no reference found; allowing delete. path="${rawPath}" probes=${JSON.stringify(probes)}`,
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
