/**
 * Cookie utility functions
 * Handles setting, getting, and removing cookies
 */

/**
 * Set a cookie
 */
export function setCookie(name: string, value: string, days: number = 7): void {
    if (typeof document === 'undefined') return;

    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

    // Encode value to handle special characters
    const encodedValue = encodeURIComponent(value);

    document.cookie = `${name}=${encodedValue};expires=${expires.toUTCString()};path=/;SameSite=Strict${window.location.protocol === 'https:' ? ';Secure' : ''
        }`;
}

/**
 * Get a cookie value
 */
export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const nameEQ = name + '=';
    const ca = document.cookie.split(';');

    for (let i = 0; i < ca.length; i++) {
        const item = ca[i];
        if (!item) continue;

        let c = item.trim();
        if (c.indexOf(nameEQ) === 0) {
            const value = c.substring(nameEQ.length, c.length);
            // Decode value to handle special characters
            return decodeURIComponent(value);
        }
    }

    return null;
}

/**
 * Remove a cookie
 */
export function removeCookie(name: string): void {
    if (typeof document === 'undefined') return;

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Strict${window.location.protocol === 'https:' ? ';Secure' : ''
        }`;
}

/**
 * Store user info in cookie for persistence
 */
export function setUserCookie(user: { id: string; email: string; name?: string | null }, days: number = 7): void {
    if (typeof document === 'undefined') return;

    const userData = JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
    });

    setCookie('user_info', userData, days);
}

/**
 * Get user info from cookie
 */
export function getUserCookie(): { id: string; email: string; name?: string | null } | null {
    if (typeof document === 'undefined') return null;

    const userData = getCookie('user_info');
    if (!userData) return null;

    try {
        return JSON.parse(userData);
    } catch {
        return null;
    }
}

/**
 * Remove user info cookie
 */
export function removeUserCookie(): void {
    removeCookie('user_info');
}

