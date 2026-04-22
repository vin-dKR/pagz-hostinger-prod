/**
 * Guest Cart Flow Utilities
 *
 * Central helpers for the deferred-authentication add-to-cart flow.
 *
 * Flow overview:
 *   1. Logged-out user clicks "Add to Cart" on any product/service surface.
 *      -> Pending item is stored in sessionStorage (see pending-purchase.ts
 *         / pending-cart-intent.ts) and the user is sent to `/cart`.
 *   2. `/cart` renders the guest pending item (read-only preview).
 *   3. When the user clicks "Checkout", we save `/checkout?...` as the
 *      post-login redirect path and send them to `/auth/login`.
 *   4. After login `AuthGuard` processes the pending intent (server-side
 *      add-to-cart) and then routes to the saved redirect path.
 *
 * These helpers wrap the primitives in `auth-redirect.ts` and
 * `pending-cart-intent.ts` so the surfaces that need to trigger the flow
 * only have to call one function.
 */

import { buildLoginUrl, saveRedirectPath, type AuthIntent } from "./auth-redirect";
import {
    clearPendingPurchaseData,
    getPendingPurchaseData,
    hasPendingPurchaseData,
    type PendingPurchaseData,
} from "./pending-purchase";

export const GUEST_CART_PATH = "/cart";

type Router = {
    push: (href: string) => void;
};

/**
 * Send a logged-out user who just clicked "Add to Cart" to the cart page.
 * Caller is responsible for calling `savePendingPurchaseData` /
 * `savePendingProductForCartIntent` BEFORE calling this, so the cart page
 * can render the pending item.
 */
export function redirectGuestToCart(router?: Router): void {
    if (router) {
        router.push(GUEST_CART_PATH);
        return;
    }
    if (typeof window !== "undefined") {
        window.location.href = GUEST_CART_PATH;
    }
}

/**
 * Called from the cart page "Checkout" button when the user is not
 * authenticated. Stashes the intended checkout URL and redirects to login
 * with the `add_to_cart` intent so `AuthGuard` will merge the pending item
 * into the server cart on the way back.
 */
export function redirectGuestToLoginForCheckout(
    checkoutPath: string = "/checkout",
    intent: AuthIntent = "add_to_cart"
): void {
    if (typeof window === "undefined") return;
    saveRedirectPath(checkoutPath);
    window.location.href = buildLoginUrl({ intent });
}

export { hasPendingPurchaseData, getPendingPurchaseData, clearPendingPurchaseData };
export type { PendingPurchaseData };
