import { Router, type IRouter } from "express";
import {
    uploadDesign,
    uploadOrderFiles,
    uploadReviewImages,
    getOrderFile,
    deleteOrderFile,
    // uploadOrderFilesAfterConfirmation - No longer needed, files uploaded immediately
} from "../controllers/uploadController.js";
import { uploadOrderFile, uploadImage } from "../middleware/upload-s3.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// Order file upload routes (customer)
// NOTE: These upload to temp location - files should ideally only be uploaded after order confirmation
router.post("/order-file", customerAuth, uploadOrderFile.single("file"), uploadDesign);
router.post("/order-files", customerAuth, uploadOrderFile.array("files", 10), uploadOrderFiles);

// Review image upload routes (customer)
router.post("/review-images", customerAuth, uploadImage.array("files", 5), uploadReviewImages);

// NOTE: Files are now uploaded immediately when user selects them on product/service page
// S3 URLs are stored in cart items and used when creating order
// This endpoint is no longer needed:
// router.post("/order/:orderId/files", customerAuth, uploadOrderFile.array("files", 10), uploadOrderFilesAfterConfirmation);

router.get("/order-file/:fileKey", customerAuth, getOrderFile);
router.delete("/order-file/:fileKey", customerAuth, deleteOrderFile);

// Legacy route (for backward compatibility)
router.post("/upload", customerAuth, uploadOrderFile.single("design"), uploadDesign);

export default router;

