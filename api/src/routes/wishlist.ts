import { Router, type IRouter } from "express";
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    checkWishlist,
} from "../controllers/wishlistController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

/**
 * Wishlist Routes
 * All routes require customer authentication
 */
router.use(customerAuth);

router.get("/", getWishlist);
router.post("/", addToWishlist);
router.delete("/:productId", removeFromWishlist);
router.get("/check/:productId", checkWishlist);

export default router;

