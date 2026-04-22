/**
 * Authentication Redirect Utility
 * Handles redirecting users to login while preserving their current location
 */

export type AuthIntent = "add_to_cart";

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
export function redirectToLoginWithReturn(
    currentPath?: string,
    options?: { intent?: AuthIntent }
): void {
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

    // Redirect to login (with optional intent hint)
    const loginUrl = new URL("/auth/login", window.location.origin);
    if (options?.intent) {
        loginUrl.searchParams.set("intent", options.intent);
    }
    window.location.href = `${loginUrl.pathname}${loginUrl.search}`;
}

/**
 * Saves a redirect path to sessionStorage without redirecting.
 * Used when we want to stash the post-login destination ahead of time
 * (e.g. when the user clicks Checkout while logged out from the cart page).
 */
export function saveRedirectPath(path: string): void {
    if (typeof window === "undefined") return;

    if (isValidRedirectPath(path)) {
        sessionStorage.setItem("redirectAfterLogin", path);
    } else {
        console.warn('[auth-redirect] Invalid redirect path, not saving:', path);
    }
}

/**
 * Builds a URL pointing at /auth/login with an optional intent query-param.
 */
export function buildLoginUrl(options?: { intent?: AuthIntent }): string {
    if (typeof window === "undefined") {
        return options?.intent ? `/auth/login?intent=${options.intent}` : "/auth/login";
    }

    const loginUrl = new URL("/auth/login", window.location.origin);
    if (options?.intent) {
        loginUrl.searchParams.set("intent", options.intent);
    }
    return `${loginUrl.pathname}${loginUrl.search}`;
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

export function getAuthIntentFromSearch(search?: string): AuthIntent | null {
    if (typeof window === "undefined" && !search) return null;
    const params = new URLSearchParams(search ?? window.location.search);
    const intent = params.get("intent");
    return intent === "add_to_cart" ? "add_to_cart" : null;
}
