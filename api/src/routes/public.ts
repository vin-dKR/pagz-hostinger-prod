import { Router, type IRouter } from "express";
import {
    getCategories,
    getProducts,
    getProduct,
    searchProducts,
    getProductAddons,
} from "../controllers/productController.js";
import {
    getCategoryBySlug,
    calculateCategoryPricePublic,
    getProductsBySpecifications,
    getCategoryAddonsPublic,
} from "../controllers/categoryController.js";
import { getCategoryTemplatesBySlug } from "../controllers/categoryTemplateController.js";
import {
    getCategoryPageControllerRulesBySlug,
    getCategoryPageControllerSettingsBySlug,
} from "../controllers/categoryPageControllerController.js";
import {
    getOffers,
    getOfferById,
    getOfferProducts,
} from "../controllers/offerController.js";
import { getCarousels } from "../controllers/carouselController.js";
import { getPublicShippingMethods } from "../controllers/shippingMethodController.js";
import { calculatePricing } from "../controllers/cartController.js";

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
router.get("/categories/:slug/templates", getCategoryTemplatesBySlug);
router.get("/categories/:slug/page-controller", getCategoryPageControllerRulesBySlug);
router.get("/categories/:slug/page-controller/settings", getCategoryPageControllerSettingsBySlug);
router.get("/products", getProducts);
router.get("/products/:id", getProduct);
router.get("/products/:id/addons", getProductAddons);
router.get("/search", searchProducts);

/**
 * Public Offers Routes
 * Routes for browsing offers and offer products
 */
router.get("/offers", getOffers);
router.get("/offers/:id", getOfferById);
router.get("/offers/:id/products", getOfferProducts);

/**
 * Public Carousel Routes
 * Routes for fetching homepage carousel items
 */
router.get("/carousels", getCarousels);

/**
 * Public Shipping Methods Routes
 * Routes for fetching active shipping methods at checkout
 */
router.get("/shipping-methods", getPublicShippingMethods);

/**
 * Public pricing endpoint (Phase 1 of per-file addon pricing — see
 * `prompts/per-file-addon-pricing-architecture.md` §2 Phase 1).
 *
 * Mounted on the public router (not `routes/cart.ts`) because the cart
 * router applies `customerAuth` to every route. Pricing must work for
 * guest sessions on `/services/<slug>`, so it lives here and the path
 * still resolves to `/api/v1/cart/calculate-pricing` via `app.use('/api/v1', publicRoutes)`.
 */
router.post("/cart/calculate-pricing", calculatePricing);

export default router;

