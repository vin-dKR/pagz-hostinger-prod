export class AppError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
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
    constructor(message: string = "Validation failed") {
        super(message, 400);
        this.name = "ValidationError";
    }
}

