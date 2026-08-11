/**
 * Domain error with an HTTP status code and a stable machine-readable code.
 * The global error handler translates instances of this class into the
 * standard `{ success: false, error: {...} }` response envelope.
 */
export class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = "AppError";
        Error.captureStackTrace?.(this, AppError);
    }
    static badRequest(message = "Bad request", details) {
        return new AppError(400, "BAD_REQUEST", message, details);
    }
    static unauthorized(message = "Unauthorized", details) {
        return new AppError(401, "UNAUTHORIZED", message, details);
    }
    static forbidden(message = "Forbidden", details) {
        return new AppError(403, "FORBIDDEN", message, details);
    }
    static notFound(message = "Resource not found", details) {
        return new AppError(404, "NOT_FOUND", message, details);
    }
    static conflict(message = "Conflict", details) {
        return new AppError(409, "CONFLICT", message, details);
    }
    static validation(message = "Validation failed", details) {
        return new AppError(422, "VALIDATION_ERROR", message, details);
    }
    static tooManyRequests(message = "Too many requests") {
        return new AppError(429, "RATE_LIMITED", message);
    }
    static internal(message = "Internal server error", details) {
        return new AppError(500, "INTERNAL_ERROR", message, details);
    }
}
