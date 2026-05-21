/**
 * File-download helper.
 *
 * Problem this solves (issue #76):
 *   Customer design files live on the same `pagz.in` host as the Next.js
 *   app. When the order-detail page renders a plain
 *   `<a href="https://pagz.in/orders/abc.pdf" target="_blank">`, some
 *   Hostinger / Apache + Node setups route the new-tab request through
 *   the Next.js process (instead of serving the static file directly).
 *   Next.js then matches `(account)/orders/[id]` with `id="abc.pdf"`,
 *   `ProtectedRoute` runs before the auth context has hydrated in the
 *   fresh tab, and the customer is bounced to `/auth/login` — even
 *   though the file itself is publicly readable.
 *
 * Fix:
 *   Don't rely on the browser following an `<a>` for the navigation.
 *   Instead, `fetch()` the absolute public URL ourselves and trigger a
 *   programmatic download from the resulting `Blob`. Two big wins:
 *     1. The response is checked — if Apache returns text/html (i.e. it
 *        routed to Next.js), we fall back to `window.open` so the user
 *        still sees *something* rather than a broken download.
 *     2. The `<a download>` we synthesise carries an explicit filename
 *        so the browser shows a save dialog instead of an in-page render
 *        (matching the existing invoice-download UX).
 *
 * No backend changes are needed — the FTP files are publicly served by
 * Hostinger; we just bypass the Next.js client-side `<a>` interception.
 */

import { getPublicFileUrl, getFilenameFromPath } from './fileUrl';

/** Response content-types we treat as "Next.js intercepted, not the file". */
const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'];

function isHtmlResponse(contentType: string | null): boolean {
    if (!contentType) return false;
    const lower = contentType.toLowerCase();
    return HTML_CONTENT_TYPES.some((t) => lower.includes(t));
}

/**
 * Trigger a file download for a stored FTP path or full URL.
 *
 * @param pathOrUrl  Relative FTP path (`orders/abc.pdf`) or absolute URL.
 * @param filename   Optional override for the saved filename. Defaults to
 *                   the basename of the path.
 *
 * @returns          Promise that resolves once the download has been
 *                   triggered (or the fallback `window.open` has been
 *                   invoked). Errors are swallowed — the fallback is
 *                   already a graceful degradation.
 */
export async function downloadPublicFile(
    pathOrUrl: string,
    filename?: string,
): Promise<void> {
    if (!pathOrUrl) return;

    const absoluteUrl = getPublicFileUrl(pathOrUrl);
    const saveAs = filename || getFilenameFromPath(pathOrUrl);

    // SSR / non-browser caller — nothing to do.
    if (typeof window === 'undefined') return;

    const openInNewTab = () => {
        // `noopener,noreferrer` mirrors the previous `<a rel>` so the
        // opened tab can't reach back into the app via `window.opener`.
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    };

    try {
        const response = await fetch(absoluteUrl, {
            method: 'GET',
            credentials: 'omit', // public file — no cookies needed
            redirect: 'follow',
        });

        if (!response.ok) {
            openInNewTab();
            return;
        }

        // If the response is HTML, Apache/Node routed us through the
        // Next.js app rather than serving the static file. Fall back to
        // a plain new-tab open so the customer at least sees the
        // (HTML) page they'd otherwise get — better than nothing.
        if (isHtmlResponse(response.headers.get('content-type'))) {
            openInNewTab();
            return;
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        try {
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = saveAs;
            // Detached anchor — never inserted into the DOM — fires the
            // browser's download handler without polluting the tree.
            anchor.rel = 'noopener noreferrer';
            anchor.click();
        } finally {
            // Revoke on the next tick so the click has a chance to start
            // the download before the object URL is invalidated.
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
        }
    } catch {
        openInNewTab();
    }
}
