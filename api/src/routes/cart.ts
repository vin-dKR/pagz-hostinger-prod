import { Router, type IRouter } from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
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

export default router;

