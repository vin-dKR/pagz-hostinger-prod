import { Router, type IRouter } from "express";
import {
    uploadFileToFTP,
    uploadMultipleFilesToFTP,
    testFTP,
    listFTP,
    deleteFTPFile,
} from "../controllers/ftpController.js";
import { uploadFTPFile, rejectEmptyFiles } from "../middleware/upload-ftp.js";
import { customerAuth } from "../middleware/auth.js";

const router: IRouter = Router();

// Test FTP connection
router.get("/test", testFTP);

// List files in FTP directory
router.get("/list", listFTP);

// Upload single file to FTP
router.post("/upload", uploadFTPFile.single("file"), rejectEmptyFiles, uploadFileToFTP);

// Upload multiple files to FTP
router.post(
    "/upload-multiple",
    uploadFTPFile.array("files", 10),
    rejectEmptyFiles,
    uploadMultipleFilesToFTP,
);

// Delete file from FTP — customer-authed so a public client can't wipe
// arbitrary paths off the bucket. The client URL-encodes slashes inside
// `filePath` (e.g. "orders%2Fabc.pdf") so the single-segment :filePath
// match still captures the full relative path; Express auto-decodes
// req.params back to the literal path.
router.delete("/delete/:filePath", customerAuth, deleteFTPFile);

export default router;
