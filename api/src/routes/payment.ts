import { Router, type IRouter } from "express";
import {
    createRazorpayOrderFromCart,
    verifyRazorpayPayment,
} from "../controllers/paymentController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// Razorpay is the only live payment gateway. The legacy `/create-order-from-cart`
// and `/verify` PhonePe routes were removed when that integration was retired —
// the storefront only ever calls the `/razorpay/*` endpoints below.
router.post("/razorpay/create-order-from-cart", customerAuth, createRazorpayOrderFromCart);
router.post("/razorpay/verify", customerAuth, verifyRazorpayPayment);

export default router;
