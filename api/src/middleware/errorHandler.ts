import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";
import { AppError } from "../utils/errors.js";

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof AppError) {
        return sendError(res, err.message, err.statusCode, err.details);
    }

    const errorMessage = err.message || "";
    const code = String((err as { code?: unknown })?.code || "");
    const name = String((err as { name?: unknown })?.name || "");

    // Multer surfaces file-size and field-count errors directly to next()
    // before any controller runs. Translate them to actionable 4xx
    // responses instead of opaque 500s.
    if (name === "MulterError" || code.startsWith("LIMIT_")) {
        if (code === "LIMIT_FILE_SIZE") {
            return sendError(res, "File is too large. Max size is 100 MB per file.", 413);
        }
        if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") {
            return sendError(res, "Too many files in this upload.", 400);
        }
        return sendError(res, errorMessage || "Upload rejected by server.", 400);
    }

    if (code === "ENAMETOOLONG") {
        return sendError(res, "File name is too long. Please rename it to a shorter name.", 400);
    }
    if (code === "ENOSPC") {
        return sendError(res, "Server storage is full. Please contact support.", 507);
    }

    // Handle database connection errors specifically
    if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("Connection") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ENOTFOUND")
    ) {
        console.error("Database connection error:", err.message);
        return sendError(
            res,
            "Database connection error. Please try again in a moment.",
            503 // Service Unavailable
        );
    }

    console.error("Unhandled error:", err);
    return sendError(res, errorMessage || "Internal server error", 500);
};

