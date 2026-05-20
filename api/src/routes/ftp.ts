import { Router, type IRouter } from "express";
import {
    uploadFileToFTP,
    uploadMultipleFilesToFTP,
    testFTP,
    listFTP,
    deleteFTPFile,
} from "../controllers/ftpController.js";
import { uploadFTPFile, rejectEmptyFiles } from "../middleware/upload-ftp.js";

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

// Delete file from FTP. Public to match the public upload routes above —
// the services page lets guests configure + upload before login, so the
// matching cleanup path can't require auth. The controller enforces a
// folder allowlist (orders/, reviews/, etc.) to limit blast radius.
// The client URL-encodes slashes inside `filePath` (e.g.
// "orders%2Fabc.pdf") so the single-segment :filePath match still
// captures the full relative path; Express auto-decodes req.params
// back to the literal path.
router.delete("/delete/:filePath", deleteFTPFile);

export default router;
