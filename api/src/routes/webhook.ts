import { Router, type IRouter } from "express";
import { phonePeWebhook } from "../controllers/paymentController.js";

const router: IRouter = Router();

// Public webhook (PhonePe will call this)
router.post("/phonepe", phonePeWebhook);

export default router;
