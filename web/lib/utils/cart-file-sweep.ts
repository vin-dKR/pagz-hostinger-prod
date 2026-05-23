/**
 * Cart File Sweep — retroactive 0KB / missing-file detection (issue #56).
 *
 * Shared by `app/cart/page.tsx` (on-mount sweep that strips bad paths
 * from each cart row) and `app/checkout/page.tsx` (pre-payment guard
 * that aborts the Razorpay flow before money is captured). All
 * verification logic lives here so the two callsites stay in lock-step.
 *
 * The backend is the authoritative check (`POST /cart/verify-files` +
 * the payment-controller guard in `createRazorpayOrderFromCart`) — this
 * module is the UX layer that surfaces failures and removes invalid
 * URLs from cart items before the user tries to pay.
 */

import { extractPathFromUrl } from './fileUrl';
import {
    verifyCartFiles,
    updateCartItem,
    type VerifyFileInvalidEntry,
} from '../api/cart';

/** A cart item shape just rich enough for the sweep — accepts whatever the
 *  cart context emits (with extra fields ignored). */
export interface SweepCartItem {
    id: string;
    quantity: number;
    customDesignUrl?: string | string[] | null;
}

export interface InvalidItemFile {
    itemId: string;
    /** The path as stored on the cart row (relative). */
    storedPath: string;
    /** Same string passed back from the API (matches whichever form
     *  we sent — full URL or relative). */
    apiPath: string;
    reason: VerifyFileInvalidEntry['reason'];
}

export interface SweepResult {
    /** True when the API returned a non-empty `invalid` list. */
    hadInvalid: boolean;
    /** Per-item details so the UI can flag the exact rows. */
    invalidByItem: Map<string, InvalidItemFile[]>;
    /** Flat list — useful for "5 files were empty" toast counts. */
    invalidEntries: InvalidItemFile[];
    /** Items that, after stripping invalid paths, have zero remaining
     *  files. Callers use this to block the checkout button. */
    itemsWithNoFilesLeft: string[];
}

/** Read `customDesignUrl` as a normalised array of trimmed strings. */
export function getItemDesignPaths(item: SweepCartItem): string[] {
    const raw = item.customDesignUrl;
    if (!raw) return [];
    const arr = Array.isArray(raw)
        ? raw.filter((s): s is string => typeof s === 'string')
        : typeof raw === 'string'
            ? [raw]
            : [];
    return arr.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Human-readable rationale per failure reason. Centralised so the cart-page
 * toast, the checkout-page block, and the pending-cart restore banner all
 * speak the same language about the same outcome — drift between these
 * messages produced the issue #87 false positives where "empty" was shown
 * for transient FTP errors that were really `unreadable`.
 */
export function describeVerifyReason(reason: VerifyFileInvalidEntry['reason']): string {
    switch (reason) {
        case 'empty':
            return 'File is empty (0 bytes)';
        case 'missing':
            return 'File not found on server';
        case 'unreadable':
        default:
            return 'Could not verify file (network); try again';
    }
}

/** Compose the singular/plural-correct toast message. */
export function formatInvalidFilesMessage(count: number): string {
    if (count <= 0) return '';
    if (count === 1) {
        return '1 file was empty or missing and has been removed. Please re-upload.';
    }
    return `${count} files were empty or missing and have been removed. Please re-upload.`;
}

/**
 * Render a detailed, per-file error message for the restore banner.
 * Always includes the filename (last URL segment) and the human-readable
 * reason so the user can act — generic "couldn't restore" messages were
 * the original UX gripe in issue #87.
 */
export function formatInvalidFilesDetail(
    entries: ReadonlyArray<{ path: string; reason: VerifyFileInvalidEntry['reason'] }>,
): string {
    if (entries.length === 0) return '';
    const lines = entries.map((e) => {
        const name = extractFileName(e.path);
        return `${name}: ${describeVerifyReason(e.reason)}`;
    });
    return lines.join('; ');
}

/** Best-effort filename extraction from either a full URL or relative path. */
function extractFileName(pathOrUrl: string): string {
    const trimmed = pathOrUrl.trim();
    if (!trimmed) return 'file';
    // Strip query/hash before pulling the last segment so URLs like
    // `https://pagz.in/orders/abc.pdf?v=1` still render `abc.pdf`.
    const cleaned = trimmed.split('?')[0]!.split('#')[0]!;
    const segments = cleaned.split('/').filter(Boolean);
    return segments[segments.length - 1] || cleaned;
}

/**
 * Run the sweep across a list of cart items: collect every design path,
 * batch-verify with the API, and (if `applyUpdates` is true) PUT each
 * affected cart row to strip the invalid paths.
 *
 * Returns the structured result so the caller can render its own toast
 * + UI state. Throws on transport errors so the caller can decide
 * whether to fail open (cart page) or block payment (checkout page).
 *
 * @param items         The cart items to sweep.
 * @param applyUpdates  When `true`, also calls `updateCartItem` for each
 *                      affected row so the bad paths disappear from the
 *                      stored cart. Use `true` from cart-page sweep,
 *                      `false` from checkout-page guard (we just want to
 *                      block; the user must go back to cart to fix).
 */
export async function sweepCartFiles(
    items: SweepCartItem[],
    applyUpdates: boolean,
): Promise<SweepResult> {
    // 1) Build the unique set of paths to probe. We send the stored
    //    form (often already a relative path) so the API response
    //    `invalid[].path` matches what we have locally.
    const allPaths = new Set<string>();
    for (const item of items) {
        for (const p of getItemDesignPaths(item)) {
            allPaths.add(p);
        }
    }

    if (allPaths.size === 0) {
        return {
            hadInvalid: false,
            invalidByItem: new Map(),
            invalidEntries: [],
            itemsWithNoFilesLeft: [],
        };
    }

    const response = await verifyCartFiles(Array.from(allPaths));
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to verify uploaded files');
    }

    const { invalid } = response.data;
    if (invalid.length === 0) {
        return {
            hadInvalid: false,
            invalidByItem: new Map(),
            invalidEntries: [],
            itemsWithNoFilesLeft: [],
        };
    }

    // 2) Match invalid paths back to the items that own them. The API
    //    normalises to relative paths server-side, but we sent the
    //    stored form, so usually `invalid.path === storedPath`. We
    //    still compare on `extractPathFromUrl()` so a mixed
    //    full-URL / relative cart still resolves correctly.
    const invalidPathSet = new Set(invalid.map((e) => extractPathFromUrl(e.path)));
    const reasonByPath = new Map(invalid.map((e) => [extractPathFromUrl(e.path), e.reason]));

    const invalidByItem = new Map<string, InvalidItemFile[]>();
    const invalidEntries: InvalidItemFile[] = [];
    const itemsToUpdate: Array<{ id: string; quantity: number; remaining: string[] }> = [];

    for (const item of items) {
        const stored = getItemDesignPaths(item);
        if (stored.length === 0) continue;

        const bad: InvalidItemFile[] = [];
        const remaining: string[] = [];
        for (const storedPath of stored) {
            const normalized = extractPathFromUrl(storedPath);
            if (invalidPathSet.has(normalized)) {
                const reason = reasonByPath.get(normalized) ?? 'unreadable';
                bad.push({ itemId: item.id, storedPath, apiPath: normalized, reason });
            } else {
                remaining.push(storedPath);
            }
        }

        if (bad.length > 0) {
            invalidByItem.set(item.id, bad);
            invalidEntries.push(...bad);
            itemsToUpdate.push({ id: item.id, quantity: item.quantity, remaining });
        }
    }

    // 3) Optionally strip the bad paths from the persisted cart rows.
    //    We update sequentially-but-in-parallel via Promise.allSettled
    //    so a single 4xx doesn't abort the rest.
    if (applyUpdates && itemsToUpdate.length > 0) {
        await Promise.allSettled(
            itemsToUpdate.map(({ id, quantity, remaining }) =>
                // Pass quantity to satisfy the existing backend
                // validation on PUT /cart/items/:id.
                updateCartItem(id, { quantity, customDesignUrl: remaining }),
            ),
        );
    }

    const itemsWithNoFilesLeft = itemsToUpdate
        .filter((u) => u.remaining.length === 0)
        .map((u) => u.id);

    return {
        hadInvalid: true,
        invalidByItem,
        invalidEntries,
        itemsWithNoFilesLeft,
    };
}
