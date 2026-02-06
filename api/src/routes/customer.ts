import { Router, type IRouter } from "express";
import {
    createOrder,
    getMyOrders,
    getOrder,
    trackOrder,
} from "../controllers/orderController.js";
import { customerAuth } from "../middleware/auth.js";
import { createAddress, updateAddress, deleteAddress } from "../controllers/addressController.js";

const router: IRouter = Router();

/**
 * Customer Routes
 * Routes for customer-specific operations (orders, addresses)
 * Most routes require customer authentication
 */

/**
 * @openapi
 * /api/v1/customer/orders/{id}/track:
 *   get:
 *     summary: Track an order by ID
 *     tags:
 *       - Orders
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Order tracking info.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   required:
 *                     - orderId
 *                     - status
 *                     - timeline
 *                   properties:
 *                     orderId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     timeline:
 *                       type: array
 *                       items:
 *                         type: object
 *       '404':
 *         description: Order not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - error
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
router.get("/orders/:id/track", trackOrder);

// Protected routes - require customer authentication
router.use(customerAuth);

/**
 * @openapi
 * /api/v1/customer/address:
 *   post:
 *     summary: Create customer address
 *     tags:
 *       - Customer
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - street
 *               - city
 *               - state
 *               - zipCode
 *               - country
 *             properties:
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Address created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   required:
 *                     - id
 *                     - userId
 *                     - street
 *                     - city
 *                     - state
 *                     - zipCode
 *                     - country
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     street:
 *                       type: string
 *                     city:
 *                       type: string
 *                     state:
 *                       type: string
 *                     zipCode:
 *                       type: string
 *                     country:
 *                       type: string
 *       '400':
 *         description: Validation error.
 *       '401':
 *         description: Unauthorized.
 */
router.post("/address", createAddress);

/**
 * @openapi
 * /api/v1/customer/address/{id}:
 *   put:
 *     summary: Update customer address
 *     tags:
 *       - Customer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *               country:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Address updated.
 *       '400':
 *         description: Validation error.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Address not found.
 */
router.put("/address/:id", updateAddress);

/**
 * @openapi
 * /api/v1/customer/address/{id}:
 *   delete:
 *     summary: Delete customer address
 *     tags:
 *       - Customer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Address deleted.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Address not found.
 */
router.delete("/address/:id", deleteAddress);

/**
 * @openapi
 * /api/v1/customer/orders:
 *   post:
 *     summary: Create an order
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - addressId
 *               - paymentMethod
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     variantId:
 *                       type: string
 *                     customDesignUrl:
 *                       type: string
 *                     customText:
 *                       type: string
 *               addressId:
 *                 type: string
 *               couponCode:
 *                 type: string
 *               shippingCharges:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [ONLINE, OFFLINE]
 *     responses:
 *       '201':
 *         description: Order created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                     subtotal:
 *                       type: number
 *                     total:
 *                       type: number
 *                     discountAmount:
 *                       type: number
 *                       nullable: true
 *                     shippingCharges:
 *                       type: number
 *                       nullable: true
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *       '400':
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - error
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *       '401':
 *         description: Unauthorized.
 */
router.post("/orders", createOrder);

/**
 * @openapi
 * /api/v1/customer/orders:
 *   get:
 *     summary: Get current customer's orders
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of customer orders.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   required:
 *                     - orders
 *                     - pagination
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       required:
 *                         - page
 *                         - limit
 *                         - total
 *                         - totalPages
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       '401':
 *         description: Unauthorized.
 */
router.get("/orders", getMyOrders);

/**
 * @openapi
 * /api/v1/customer/orders/{id}:
 *   get:
 *     summary: Get a customer's order by ID
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Order details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       '401':
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - error
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *       '404':
 *         description: Order not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - error
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
router.get("/orders/:id", getOrder);

export default router;
