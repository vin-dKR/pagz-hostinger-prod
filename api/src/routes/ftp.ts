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

// Delete file from FTP
router.delete("/delete/:filePath", deleteFTPFile);

export default router;
