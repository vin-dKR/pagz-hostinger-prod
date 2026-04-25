/**
 * PDF first-page thumbnail rendering.
 *
 * Loads pdf.js lazily (the worker bundle is ~1MB) and renders the first page
 * of a PDF to a small PNG dataURL. Used by the cart UI to show a preview
 * thumbnail next to each uploaded file, the same way polar.sh shows
 * file thumbnails on its upload widgets.
 *
 * The util is callable in two modes:
 *   1. fromUrl(url)   — for cart items whose PDFs already live on S3/FTP.
 *   2. fromFile(file) — for fresh File objects during the upload flow.
 *
 * Renders are cached in-memory (Map by url) so revisiting the cart doesn't
 * re-render the same PDF on every mount.
 */

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

const THUMB_PIXEL_WIDTH = 120;

let pdfjsModulePromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** Lazy-load pdfjs-dist + configure its worker. The worker is bundled with
 *  the library; we point at the CDN copy keyed to the installed version so
 *  the bundle stays small in dev. */
async function loadPdfjs(): Promise<typeof import("pdfjs-dist") | null> {
    if (typeof window === "undefined") return null;
    if (!pdfjsModulePromise) {
        pdfjsModulePromise = import("pdfjs-dist").then((mod) => {
            try {
                // The worker URL has to match the loaded version exactly or
                // pdfjs throws "API version does not match Worker version".
                // unpkg mirrors any installed npm version so we never drift.
                // Match the worker host already in use by file-validation.ts
                // (jsdelivr) so we don't pay a second DNS lookup or CDN cache.
                const version = (mod as { version?: string }).version ?? "5.4.530";
                if (!(mod as any).GlobalWorkerOptions.workerSrc) {
                    (mod as any).GlobalWorkerOptions.workerSrc =
                        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                }
            } catch {
                // Best-effort — if the worker can't be configured we still
                // attempt the render and let pdfjs surface its own error.
            }
            return mod;
        });
    }
    return pdfjsModulePromise;
}

async function renderFirstPage(
    source: ArrayBuffer | { url: string }
): Promise<string | null> {
    const pdfjs = await loadPdfjs();
    if (!pdfjs) return null;

    const loadingTask = (pdfjs as any).getDocument(
        source instanceof ArrayBuffer ? { data: source } : source
    );
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

/** Render a PDF from a File / Blob to a dataURL. Caller should hold the
 *  result on the file record so we don't re-render on each mount. */
export async function generatePdfThumbnailFromFile(file: File): Promise<string | null> {
    try {
        const buffer = await file.arrayBuffer();
        // Cloning into a fresh ArrayBuffer keeps pdfjs from detaching the
        // original (some bundlers reuse it for File reads).
        const data = buffer.slice(0);
        return await renderFirstPage(data);
    } catch (err) {
        console.warn("[pdf-thumbnail] file render failed:", err);
        return null;
    }
}

/** Render a PDF from a URL, caching the dataURL by URL. Returns null if the
 *  fetch / render fails (CORS, 404, malformed PDF). The cart UI falls back
 *  to a generic icon in that case. */
export async function generatePdfThumbnailFromUrl(url: string): Promise<string | null> {
    if (!url) return null;
    if (cache.has(url)) return cache.get(url) ?? null;
    if (inFlight.has(url)) return inFlight.get(url) ?? null;

    const promise = (async () => {
        try {
            const result = await renderFirstPage({ url });
            if (result) cache.set(url, result);
            return result;
        } catch (err) {
            console.warn("[pdf-thumbnail] url render failed:", url, err);
            return null;
        } finally {
            inFlight.delete(url);
        }
    })();

    inFlight.set(url, promise);
    return promise;
}

/** Heuristic: filename / URL ends in .pdf. */
export function isPdfFile(pathOrUrl: string): boolean {
    if (!pathOrUrl) return false;
    const lower = (pathOrUrl.split("?")[0] ?? "").toLowerCase();
    return lower.endsWith(".pdf");
}
