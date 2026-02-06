import { Router, type IRouter } from "express";
import {
    register,
    login,
    getProfile,
    updateProfile,
    updatePassword,
    updateNotificationPreferences,
    deleteAccount,
    refreshToken,
} from "../controllers/authController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new customer
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       '201':
 *         description: Customer registered successfully.
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
 *                     - email
 *                     - name
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *       '400':
 *         description: Validation or registration error.
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
 *               example:
*                  success: false
*                  error: Invalid email format
*/
router.post("/register", register);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login a customer
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       '200':
 *         description: Login successful.
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
 *                     - user
 *                     - token
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       required:
 *                         - id
 *                         - email
 *                         - name
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                           format: email
 *                         name:
 *                           type: string
 *       '401':
 *         description: Invalid credentials.
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
 *               example:
 *                 success: false
 *                 error: Invalid email or password format or others
 */
router.post("/login", login);

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh authentication token
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Token refreshed successfully.
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
 *                     - user
 *                     - token
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *       '401':
 *         description: Unauthorized - invalid or expired token.
 */
router.post("/refresh", customerAuth, refreshToken);

/**
 * @openapi
 * /api/v1/auth/user/profile:
 *   get:
 *     summary: Get current customer profile
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Customer profile returned.
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
 *                     - id
 *                     - email
 *                     - name
 *                     - isAdmin
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     isAdmin:
 *                       type: boolean
 *                     addresses:
 *                       type: array
 *                       items:
 *                         type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
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
 */
router.get("/user/profile", customerAuth, getProfile);

/**
 * @openapi
 * /api/v1/auth/user/profile:
 *   put:
 *     summary: Update customer profile
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Profile updated successfully.
 *       '401':
 *         description: Unauthorized.
 */
router.put("/user/profile", customerAuth, updateProfile);

/**
 * @openapi
 * /api/v1/auth/user/password:
 *   put:
 *     summary: Update user password
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Password updated successfully.
 *       '400':
 *         description: Invalid input or incorrect current password.
 *       '401':
 *         description: Unauthorized.
 */
router.put("/user/password", customerAuth, updatePassword);

/**
 * @openapi
 * /api/v1/auth/user/notifications:
 *   put:
 *     summary: Update notification preferences
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - preferences
 *             properties:
 *               preferences:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Notification preferences updated successfully.
 *       '401':
 *         description: Unauthorized.
 */
router.put("/user/notifications", customerAuth, updateNotificationPreferences);

/**
 * @openapi
 * /api/v1/auth/user/account:
 *   delete:
 *     summary: Delete user account
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Account deleted successfully.
 *       '401':
 *         description: Unauthorized.
 */
router.delete("/user/account", customerAuth, deleteAccount);

export default router;
