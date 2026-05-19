import { Router, type IRouter } from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    validateCartMinimums,
    verifyCartFiles,
} from "../controllers/cartController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

/**
 * Cart Routes
 * All routes require customer authentication
 */
router.use(customerAuth);

/**
 * @openapi
 * /api/v1/cart:
 *   get:
 *     summary: Get current cart
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Cart details.
 *       '401':
 *         description: Unauthorized.
 */
router.get("/", getCart);

/**
 * @openapi
 * /api/v1/cart/items:
 *   post:
 *     summary: Add item to cart
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               variantId:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Item added to cart.
 *       '400':
 *         description: Validation error.
 *       '401':
 *         description: Unauthorized.
 */
router.post("/items", addToCart);

/**
 * @openapi
 * /api/v1/cart/items/{itemId}:
 *   put:
 *     summary: Update cart item
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: itemId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *     responses:
 *       '200':
 *         description: Cart item updated.
 *       '400':
 *         description: Validation error.
 *       '401':
 *         description: Unauthorized.
 *   delete:
 *     summary: Remove cart item
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: itemId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: Cart item removed.
 *       '401':
 *         description: Unauthorized.
 */
router.put("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", removeFromCart);

/**
 * @openapi
 * /api/v1/cart/clear:
 *   delete:
 *     summary: Clear cart
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '204':
 *         description: Cart cleared.
 *       '401':
 *         description: Unauthorized.
 */
router.delete("/clear", clearCart);

/**
 * @openapi
 * /api/v1/cart/validate-minimums:
 *   post:
 *     summary: Validate per-category minimum cart values
 *     description: |
 *       Preflight check used before navigating to checkout. Returns the list
 *       of categories whose subtotal falls below their configured
 *       `minCartValue`. Pass `itemIds` to limit the check to a subset of
 *       cart items (matches the cart-page selection UX).
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: Validation result (see `shortfalls`).
 *       '401':
 *         description: Unauthorized.
 */
router.post("/validate-minimums", validateCartMinimums);

/**
 * @openapi
 * /api/v1/cart/verify-files:
 *   post:
 *     summary: Verify FTP-stored design files still exist and are non-empty
 *     description: |
 *       Retroactive sweep used by the cart and checkout pages (and the
 *       server-side payment guard) to detect 0-byte or missing files
 *       attached to cart items. The client strips invalid paths from
 *       the cart row and blocks checkout until the user re-uploads.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paths
 *             properties:
 *               paths:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       '200':
 *         description: |
 *           `{ valid: string[], invalid: Array<{ path, reason }> }` where
 *           reason ∈ "missing" | "empty" | "unreadable".
 *       '401':
 *         description: Unauthorized.
 */
router.post("/verify-files", verifyCartFiles);

export default router;

