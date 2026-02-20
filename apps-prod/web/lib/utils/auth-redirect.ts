/**
 * Authentication Redirect Utility
 * Handles redirecting users to login while preserving their current location
 */

/**
 * Validates if a redirect path is safe to use
 * @param path - The path to validate
 * @returns true if path is safe, false otherwise
 */
function isValidRedirectPath(path: string): boolean {
    // Only allow relative paths (same origin)
    if (!path.startsWith("/")) return false;

    // Don't allow redirect to auth pages (prevent loops)
    if (path.startsWith("/auth/")) return false;

    // Don't allow external URLs
    if (path.startsWith("http://") || path.startsWith("https://")) return false;

    return true;
}

/**
 * Redirects user to login page while saving current location for return
 * @param currentPath - Optional current path. If not provided, uses window.location
 */
export function redirectToLoginWithReturn(currentPath?: string): void {
    if (typeof window === "undefined") return;

    // Get current path if not provided
    const path =
        currentPath || window.location.pathname + window.location.search;

    // Validate path (security)
    if (isValidRedirectPath(path)) {
        sessionStorage.setItem("redirectAfterLogin", path);
    } else {
        console.warn('[auth-redirect] Invalid redirect path, not saving:', path);
    }

    // Redirect to login
    window.location.href = "/auth/login";
}

/**
 * Gets the saved redirect path and validates it
 * @returns The redirect path if valid, null otherwise
 */
export function getRedirectPath(): string | null {
    if (typeof window === "undefined") return null;

    const redirectPath = sessionStorage.getItem("redirectAfterLogin");

    if (!redirectPath) return null;

    // Validate the path before returning
    if (isValidRedirectPath(redirectPath)) {
        return redirectPath;
    }

    // If invalid, clear it and return null
    sessionStorage.removeItem("redirectAfterLogin");
    return null;
}

/**
 * Clears the saved redirect path
 */
export function clearRedirectPath(): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("redirectAfterLogin");
}
