/**
 * PDF first-page thumbnail rendering for admin file previews.
 *
 * Lazy-loads pdfjs-dist, renders the first page of a PDF URL to a small
 * PNG dataURL, caches by URL. Mirrors web/lib/utils/pdf-thumbnail.ts so
 * admin and customer-facing surfaces show the same preview style.
 */

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

const THUMB_PIXEL_WIDTH = 160;

let pdfjsModulePromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs(): Promise<typeof import("pdfjs-dist") | null> {
    if (typeof window === "undefined") return null;
    if (!pdfjsModulePromise) {
        pdfjsModulePromise = import("pdfjs-dist").then((mod) => {
            try {
                const version = (mod as { version?: string }).version ?? "5.4.530";
                if (!(mod as any).GlobalWorkerOptions.workerSrc) {
                    (mod as any).GlobalWorkerOptions.workerSrc =
                        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                }
            } catch {
                // best-effort
            }
            return mod;
        });
    }
    return pdfjsModulePromise;
}

async function renderFirstPage(url: string): Promise<string | null> {
    const pdfjs = await loadPdfjs();
    if (!pdfjs) return null;

    const loadingTask = (pdfjs as any).getDocument({ url });
    const pdf = await loadingTask.promise;
    try {
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = THUMB_PIXEL_WIDTH / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        return canvas.toDataURL("image/png");
    } finally {
        try { await pdf.destroy(); } catch { /* ignore */ }
    }
}

/** Render PDF from URL, cache by URL. Null on failure (CORS / 404 / bad PDF). */
export async function generatePdfThumbnailFromUrl(url: string): Promise<string | null> {
    if (!url) return null;
    if (cache.has(url)) return cache.get(url) ?? null;
    if (inFlight.has(url)) return inFlight.get(url) ?? null;

    const promise = (async () => {
        try {
            const result = await renderFirstPage(url);
            if (result) cache.set(url, result);
            return result;
        } catch (err) {
            console.warn("[pdf-thumbnail] render failed:", url, err);
            return null;
        } finally {
            inFlight.delete(url);
        }
    })();

    inFlight.set(url, promise);
    return promise;
}

export function isPdfFile(pathOrUrl: string): boolean {
    if (!pathOrUrl) return false;
    const lower = (pathOrUrl.split("?")[0] ?? "").toLowerCase();
    return lower.endsWith(".pdf");
}
