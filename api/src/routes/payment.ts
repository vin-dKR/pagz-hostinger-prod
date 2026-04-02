import { Router, type IRouter } from "express";
import {
    createPhonePeOrderFromCart,
    createRazorpayOrderFromCart,
    verifyPhonePePayment,
    verifyRazorpayPayment,
} from "../controllers/paymentController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// Protected routes
router.post("/create-order-from-cart", customerAuth, createPhonePeOrderFromCart);
router.post("/verify", customerAuth, verifyPhonePePayment);
router.post("/razorpay/create-order-from-cart", customerAuth, createRazorpayOrderFromCart);
router.post("/razorpay/verify", customerAuth, verifyRazorpayPayment);

export default router;
