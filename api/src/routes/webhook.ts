import { Router, type IRouter } from "express";
import { razorpayWebhook } from "../controllers/paymentController.js";

const router: IRouter = Router();

// Public webhook (Razorpay will call this)
router.post("/razorpay", razorpayWebhook);

export default router;

