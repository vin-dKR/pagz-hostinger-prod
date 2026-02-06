import { Router, type IRouter } from "express";
import {
    createRazorpayOrder,
    createRazorpayOrderFromCart,
    verifyPayment,
    razorpayWebhook,
} from "../controllers/paymentController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// Protected routes
router.post("/create-order", customerAuth, createRazorpayOrder); // Legacy: for existing orders
router.post("/create-order-from-cart", customerAuth, createRazorpayOrderFromCart); // New: creates order only after payment
router.post("/verify", customerAuth, verifyPayment);

// Public webhook (Razorpay will call this)
// Note: This route is registered separately in index.ts as /api/webhooks/razorpay

export default router;

