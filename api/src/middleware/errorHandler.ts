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
        return sendError(res, err.message, err.statusCode);
    }

    // Handle database connection errors specifically
    const errorMessage = err.message || "";
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
    return sendError(res, "Internal server error", 500);
};

