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
    forgotPassword,
    verifyOTPController,
    resetPassword,
    sendOtp,
} from "../controllers/authController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

/**
 * @openapi
 * /api/v1/auth/send-otp:
 *   post:
 *     summary: Send OTP to mobile (signup or password reset)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *               purpose:
 *                 type: string
 *                 enum: [SIGNUP, RESET_PASSWORD]
 *     responses:
 *       '200':
 *         description: OTP sent.
 */
router.post("/send-otp", sendOtp);

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new customer (requires OTP)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       '201':
 *         description: Customer registered successfully.
 */
router.post("/register", register);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with phone or email + password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       '200':
 *         description: Login successful.
 */
router.post("/login", login);

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP via SMS
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       '200':
 *         description: OTP sent if account exists.
 */
router.post("/forgot-password", forgotPassword);

/**
 * @openapi
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP (no consume)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *               purpose:
 *                 type: string
 *                 enum: [SIGNUP, RESET_PASSWORD]
 *     responses:
 *       '200':
 *         description: OTP valid.
 */
router.post("/verify-otp", verifyOTPController);

/**
 * @openapi
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with phone OTP
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       '200':
 *         description: Password reset successful.
 */
router.post("/reset-password", resetPassword);

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
 */
router.get("/user/profile", customerAuth, getProfile);

/**
 * @openapi
 * /api/v1/auth/user/profile:
 *   put:
 *     summary: Update customer profile (name, email)
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
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       '200':
 *         description: Profile updated successfully.
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
 */
router.delete("/user/account", customerAuth, deleteAccount);

export default router;
