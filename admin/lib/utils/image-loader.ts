/**
 * Custom image loader for Next.js Image component
 * This loader returns the source URL as-is, bypassing Next.js image optimization
 * Useful for external images that should be served directly
 */
export const imageLoader = ({ src }: { src: string }): string => {
    return src;
};
