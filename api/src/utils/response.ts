import { Response } from "express";

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode: number = 200) => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        ...(message && { message }),
    };
    return res.status(statusCode).json(response);
};

export const sendError = (res: Response, error: string, statusCode: number = 400) => {
    const response: ApiResponse = {
        success: false,
        error,
    };
    return res.status(statusCode).json(response);
};

