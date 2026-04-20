import { Router, type IRouter } from "express";
import {
    getProductReviews,
    createReview,
    updateReview,
    deleteReview,
    voteReviewHelpful,
    removeHelpfulVote,
    getCategoryReviews,
    createCategoryReview,
    canReviewCategory,
    getTestimonials,
} from "../controllers/reviewController.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

/**
 * Review Routes
 * Public routes for viewing reviews
 * Protected routes for creating/updating reviews
 */

// Public routes
router.get("/testimonials", getTestimonials);
router.get("/category/:categoryId", getCategoryReviews);
router.get("/product/:productId", getProductReviews);

// Protected routes
router.use(customerAuth);
router.get("/category/:categoryId/can-review", canReviewCategory);
router.post("/category/:categoryId", createCategoryReview);
router.post("/product/:productId", createReview);
router.put("/:reviewId", updateReview);
router.delete("/:reviewId", deleteReview);
router.post("/:reviewId/helpful", voteReviewHelpful);
router.delete("/:reviewId/helpful", removeHelpfulVote);

export default router;

