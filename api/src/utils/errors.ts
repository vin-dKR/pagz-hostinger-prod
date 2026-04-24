export class AppError extends Error {
    statusCode: number;
    /**
     * Optional structured payload surfaced alongside the error message.
     * Used by the error handler to let the client display actionable details
     * (e.g. per-category shortfall info for cart-minimum failures).
     */
    details?: unknown;

    constructor(message: string, statusCode: number = 400, details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
        if (details !== undefined) {
            this.details = details;
        }
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = "Resource not found") {
        super(message, 404);
        this.name = "NotFoundError";
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = "Unauthorized") {
        super(message, 401);
        this.name = "UnauthorizedError";
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "Forbidden") {
        super(message, 403);
        this.name = "ForbiddenError";
    }
}

export class ValidationError extends AppError {
    constructor(message: string = "Validation failed", details?: unknown) {
        super(message, 400, details);
        this.name = "ValidationError";
    }
}

/**
 * Raised when the cart fails per-category minimum-value rules.
 * `details.shortfalls` lists each offending category with its current
 * subtotal and required minimum so clients can render a per-category
 * warning instead of a single generic message.
 */
export interface CategoryCartShortfall {
    categoryId: string;
    categoryName: string;
    required: number;
    current: number;
}

export class CartMinimumError extends AppError {
    constructor(shortfalls: CategoryCartShortfall[]) {
        super(
            "One or more categories do not meet their minimum cart value",
            400,
            { shortfalls }
        );
        this.name = "CartMinimumError";
    }
}

