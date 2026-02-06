import { Router, type IRouter } from "express";
import {
    getCategories,
    getProducts,
    getProduct,
    searchProducts,
} from "../controllers/productController.js";
import {
    getCategoryBySlug,
    calculateCategoryPricePublic,
    getProductsBySpecifications,
    getCategoryAddonsPublic,
} from "../controllers/categoryController.js";
import {
    getOffers,
    getOfferById,
    getOfferProducts,
} from "../controllers/offerController.js";

const router: IRouter = Router();

/**
 * Public Product Catalog Routes
 * These routes are accessible to both customers and admins (no authentication required)
 * Used for browsing products and categories
 */
router.get("/categories", getCategories);
router.get("/categories/:slug", getCategoryBySlug);
router.get("/categories/:slug/products", getProductsBySpecifications);
router.post("/categories/:slug/calculate-price", calculateCategoryPricePublic);
router.get("/categories/:slug/addons", getCategoryAddonsPublic);
router.get("/products", getProducts);
router.get("/products/:id", getProduct);
router.get("/search", searchProducts);

/**
 * Public Offers Routes
 * Routes for browsing offers and offer products
 */
router.get("/offers", getOffers);
router.get("/offers/:id", getOfferById);
router.get("/offers/:id/products", getOfferProducts);

export default router;

