/**
 * File-download helper (admin mirror of `web/lib/utils/file-download.ts`).
 *
 * Admin order detail renders the same `<a target="_blank">` design-file
 * links as the customer-facing app. On Hostinger those clicks can be
 * intercepted by the Next.js app (path collision with `/orders/[id]`),
 * sending the admin to a `(dashboard)` auth gate. Mirror the customer
 * fix here so the behaviour stays consistent across both panels.
 *
 * Keep the implementation 1:1 with the web copy — same content-type
 * sniffing, same fallback to `window.open`. The two panels each have
 * their own `lib/utils/fileUrl.ts` (separate apps, separate
 * `node_modules`), so the helper is duplicated rather than shared.
 */

import { getPublicFileUrl, getFilenameFromPath } from './fileUrl';

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
 */
export async function downloadPublicFile(
    pathOrUrl: string,
    filename?: string,
): Promise<void> {
    if (!pathOrUrl) return;

    const absoluteUrl = getPublicFileUrl(pathOrUrl);
    const saveAs = filename || getFilenameFromPath(pathOrUrl);

    if (typeof window === 'undefined') return;

    const openInNewTab = () => {
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    };

    try {
        const response = await fetch(absoluteUrl, {
            method: 'GET',
            credentials: 'omit',
            redirect: 'follow',
        });

        if (!response.ok) {
            openInNewTab();
            return;
        }

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
            anchor.rel = 'noopener noreferrer';
            anchor.click();
        } finally {
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
        }
    } catch {
        openInNewTab();
    }
}
