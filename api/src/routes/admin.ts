import { Router, type IRouter } from "express";
import {
    createProduct,
    updateProduct,
    deleteProduct,
    addVariant,
    createCategoties,
    getAdminCategories,
    getAdminProducts,
    getAdminProduct,
} from "../controllers/productController.js";
import {
    getAdminOrders,
    getAdminOrder,
    updateOrderStatus,
    updateOrder,
    cancelOrder,
    getOrderStatistics,
    markPaymentAsPaid,
    processRefund,
    getPaymentDetails,
    updateTracking,
    markAsShipped,
    markAsDelivered,
    getOrderInvoice,
    exportOrders,
} from "../controllers/orderController.js";
import { getDashboardOverview } from "../controllers/dashboardController.js";
import { adminAuth } from "../middleware/auth.js";
import {
    deleteAdminUser,
    getAdminUser,
    getAdminUsers,
    updateAdminUser,
    createAdminUser,
    getUserStatistics,
    getUserStatisticsById,
    getUserOrders,
    getUserAddresses,
    getUserPayments,
    getUserReviews,
    getUserWishlistAndCart,
    addUserAddress,
    updateUserAddress,
    deleteUserAddress,
    setDefaultAddress,
    exportUsers,
    resetUserPassword,
    suspendUser,
    activateUser,
} from "../controllers/userController.js";
import {
    getAdminCoupon,
    getAdminCoupons,
    createAdminCoupon,
    updateAdminCoupon,
    deleteAdminCoupon,
    getCouponStats,
    getCouponAnalytics,
    bulkCouponOperation,
    getCouponUsages,
    getCouponProducts,
    addCouponProducts,
    removeCouponProducts,
    getCouponCategories,
    addCouponCategories,
    removeCouponCategories,
} from "../controllers/couponController.js";
import { getAdminPayment, getAdminPayments } from "../controllers/paymentController.js";
import {
    deleteAdminReview,
    getAdminReviews,
    getAdminReview,
    updateAdminReview,
    approveReview,
    rejectReview,
    getReviewStatistics,
    bulkApproveReviews,
    bulkRejectReviews,
    bulkDeleteReviews,
    editAdminReview,
} from "../controllers/reviewController.js";
import {
    getCategorySpecifications,
    createCategorySpecification,
    updateCategorySpecification,
    deleteCategorySpecification,
    getSpecificationOptions,
    createSpecificationOption,
    updateSpecificationOption,
    deleteSpecificationOption,
    getCategoryPricingRules,
    createCategoryPricingRule,
    updateCategoryPricingRule,
    deleteCategoryPricingRule,
    calculateCategoryPrice,
    getCategoryConfiguration,
    upsertCategoryConfiguration,
    getCategoryImages,
    createCategoryImage,
    updateCategoryImage,
    deleteCategoryImage,
    previewProductFromPricingRule,
    publishPricingRuleAsProduct,
} from "../controllers/categoryController.js";

// Upload Management (admin only)
import {
    uploadProductImage,
    uploadProductImages,
    deleteProductImage,
    uploadCategoryImage,
    deleteCategoryImage as deleteCategoryImageUpload,
} from "../controllers/uploadController.js";
import { uploadImage } from "../middleware/upload-s3.js";

const router: IRouter = Router();

/**
 * Admin Management Routes
 * All routes require admin authentication
 * These routes are for managing products, categories, and orders
 */
router.use(adminAuth);

// Product & Category Management (admin only)
// Dashboard
router.get("/dashboard/overview", getDashboardOverview);

// Product & Category Management (admin only)
router.get("/categories", getAdminCategories);
router.post("/categories", createCategoties);

// Admin Products
router.get("/products", getAdminProducts);
router.get("/products/:id", getAdminProduct);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);
router.post("/products/:id/variants", addVariant);

// Order Management (admin only)
router.get("/orders", getAdminOrders);
router.get("/orders/statistics", getOrderStatistics);
router.get("/orders/export", exportOrders);
router.get("/orders/:id", getAdminOrder);
router.put("/orders/:id", updateOrder);
router.patch("/orders/:id/status", updateOrderStatus);
router.post("/orders/:id/cancel", cancelOrder);
router.get("/orders/:id/invoice", getOrderInvoice);

// Payment Management (admin only)
router.get("/orders/:id/payment", getPaymentDetails);
router.post("/orders/:id/payment/mark-paid", markPaymentAsPaid);
router.post("/orders/:id/payment/refund", processRefund);

// Shipping Management (admin only)
router.patch("/orders/:id/tracking", updateTracking);
router.post("/orders/:id/ship", markAsShipped);
router.post("/orders/:id/deliver", markAsDelivered);

// Customer User Management (admin only - manages customer users only)
router.get("/users", getAdminUsers);
router.get("/users/statistics", getUserStatistics);
router.get("/users/export", exportUsers);
router.post("/users", createAdminUser);
router.get("/users/:id", getAdminUser);
router.put("/users/:id", updateAdminUser);
router.delete("/users/:id", deleteAdminUser);
router.get("/users/:id/statistics", getUserStatisticsById);
router.get("/users/:id/orders", getUserOrders);
router.get("/users/:id/addresses", getUserAddresses);
router.post("/users/:id/addresses", addUserAddress);
router.put("/users/:id/addresses/:addressId", updateUserAddress);
router.delete("/users/:id/addresses/:addressId", deleteUserAddress);
router.patch("/users/:id/addresses/:addressId/set-default", setDefaultAddress);
router.get("/users/:id/payments", getUserPayments);
router.get("/users/:id/reviews", getUserReviews);
router.get("/users/:id/wishlist-cart", getUserWishlistAndCart);
router.post("/users/:id/reset-password", resetUserPassword);
router.post("/users/:id/suspend", suspendUser);
router.post("/users/:id/activate", activateUser);

// Coupon Management (admin only)
router.get("/coupons/stats", getCouponStats);
router.get("/coupons", getAdminCoupons);
router.get("/coupons/:id", getAdminCoupon);
router.get("/coupons/:id/analytics", getCouponAnalytics);
router.get("/coupons/:id/usages", getCouponUsages);
router.post("/coupons", createAdminCoupon);
router.post("/coupons/bulk", bulkCouponOperation);
router.put("/coupons/:id", updateAdminCoupon);
router.delete("/coupons/:id", deleteAdminCoupon);
// Coupon Products & Categories Management
router.get("/coupons/:id/products", getCouponProducts);
router.post("/coupons/:id/products", addCouponProducts);
router.post("/coupons/:id/products/remove", removeCouponProducts);
router.get("/coupons/:id/categories", getCouponCategories);
router.post("/coupons/:id/categories", addCouponCategories);
router.post("/coupons/:id/categories/remove", removeCouponCategories);

// Payment Management (admin only)
router.get("/payments", getAdminPayments);
router.get("/payments/:id", getAdminPayment);

// Review Management (admin only)
router.get("/reviews", getAdminReviews);
router.get("/reviews/statistics", getReviewStatistics);
router.get("/reviews/:id", getAdminReview);
router.put("/reviews/:id", updateAdminReview);
router.post("/reviews/:id/approve", approveReview);
router.post("/reviews/:id/reject", rejectReview);
router.put("/reviews/:id/edit", editAdminReview);
router.delete("/reviews/:id", deleteAdminReview);
router.post("/reviews/bulk-approve", bulkApproveReviews);
router.post("/reviews/bulk-reject", bulkRejectReviews);
router.post("/reviews/bulk-delete", bulkDeleteReviews);

// Category Specifications Management (admin only)
router.get("/categories/:id/specifications", getCategorySpecifications);
router.post("/categories/:id/specifications", createCategorySpecification);
router.put("/categories/:id/specifications/:specId", updateCategorySpecification);
router.delete("/categories/:id/specifications/:specId", deleteCategorySpecification);

// Specification Options Management (admin only)
router.get("/categories/:id/specifications/:specId/options", getSpecificationOptions);
router.post("/categories/:id/specifications/:specId/options", createSpecificationOption);
router.put("/categories/:id/specifications/:specId/options/:optionId", updateSpecificationOption);
router.delete("/categories/:id/specifications/:specId/options/:optionId", deleteSpecificationOption);

// Category Pricing Rules Management (admin only)
router.get("/categories/:id/pricing", getCategoryPricingRules);
router.post("/categories/:id/pricing", createCategoryPricingRule);
router.put("/categories/:id/pricing/:ruleId", updateCategoryPricingRule);
router.delete("/categories/:id/pricing/:ruleId", deleteCategoryPricingRule);
router.post("/categories/:id/pricing/calculate", calculateCategoryPrice);

// Category Configuration Management (admin only)
router.get("/categories/:id/configuration", getCategoryConfiguration);
router.put("/categories/:id/configuration", upsertCategoryConfiguration);

// Category Images Management (admin only)
router.get("/categories/:id/images", getCategoryImages);
router.post("/categories/:id/images", createCategoryImage);
router.put("/categories/:id/images/:imageId", updateCategoryImage);
router.delete("/categories/:id/images/:imageId", deleteCategoryImage);

// Publish Pricing Rule as Product (admin only)
router.get("/categories/:categoryId/pricing-rules/:ruleId/preview-product", previewProductFromPricingRule);
router.post("/categories/:categoryId/pricing-rules/:ruleId/publish", publishPricingRuleAsProduct);



// Product Image Upload Routes
router.post("/upload/product-image", uploadImage.single("file"), uploadProductImage);
router.post("/upload/product-images", uploadImage.array("files", 10), uploadProductImages);
router.delete("/upload/product-image/:imageId", deleteProductImage);

// Category Image Upload Routes
router.post("/upload/category-image", uploadImage.single("file"), uploadCategoryImage);
router.post("/upload/category-image/:categoryId", uploadImage.single("file"), uploadCategoryImage);
router.delete("/upload/category-image/:imageId", deleteCategoryImageUpload);

export default router;
