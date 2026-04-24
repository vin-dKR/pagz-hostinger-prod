import { Response } from "express";

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    /**
     * Optional structured error metadata (e.g. per-category cart-minimum
     * shortfall details). Set alongside `error` on 4xx responses when the
     * client needs more than a human-readable message to render.
     */
    details?: unknown;
}

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode: number = 200) => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        ...(message && { message }),
    };
    return res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    error: string,
    statusCode: number = 400,
    details?: unknown,
) => {
    const response: ApiResponse = {
        success: false,
        error,
        ...(details !== undefined && { details }),
    };
    return res.status(statusCode).json(response);
};

