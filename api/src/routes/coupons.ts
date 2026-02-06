import { Router, type IRouter } from "express";
import {
    validateCoupon,
    getAvailableCoupons,
    getMyCoupons,
    getCouponById,
    getCouponProductsPublic,
} from "../controllers/couponController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

/**
 * Coupon Routes
 * Public routes for viewing available coupons
 * Protected routes for validating and using coupons
 */

// Public routes
router.get("/available", getAvailableCoupons);
router.get("/:id", getCouponById);
router.get("/:id/products", getCouponProductsPublic);

// Protected routes
router.use(customerAuth);
router.post("/validate", validateCoupon);
router.get("/my-coupons", getMyCoupons);

export default router;

