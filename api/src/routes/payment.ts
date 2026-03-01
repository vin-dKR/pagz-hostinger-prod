import { Router, type IRouter } from "express";
import {
    createPhonePeOrderFromCart,
    verifyPhonePePayment,
} from "../controllers/paymentController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// Protected routes
router.post("/create-order-from-cart", customerAuth, createPhonePeOrderFromCart);
router.post("/verify", customerAuth, verifyPhonePePayment);

export default router;
