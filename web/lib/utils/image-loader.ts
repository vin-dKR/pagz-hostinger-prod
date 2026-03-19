/**
 * Custom image loader for Next.js Image component
 * This loader returns the source URL as-is, bypassing Next.js image optimization
 * Useful for external images that should be served directly
 */
export const imageLoader = ({
    src,
}: {
    src: string;
    // Next.js requires `width` to be present in the loader signature even if
    // the implementation ignores it (we bypass optimization anyway).
    width: number;
    quality?: number;
}): string => {
    const uploadsBaseUrl =
        process.env.NEXT_PUBLIC_UPLOADS_BASE_URL || "https://pagz.in";

    // If src is already absolute (http(s), data, etc.) return as-is.
    if (
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("data:") ||
        src.startsWith("blob:") ||
        src.startsWith("mailto:")
    ) {
    return src;
    }

    // Keep root-relative paths (e.g. `/images/rows/row1.png` from Next `public/`) as-is.
    if (src.startsWith("/")) return src;

    // Convert relative upload paths like `categories/foo.jpg` into absolute URLs
    // so they don't get requested from the current route (e.g. `/services/...`).
    return `${uploadsBaseUrl}/${src}`;
};
