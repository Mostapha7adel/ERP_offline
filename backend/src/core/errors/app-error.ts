/**
 * Domain error with an HTTP status code and a stable machine-readable code.
 * The global error handler translates instances of this class into the
 * standard `{ success: false, error: {...} }` response envelope.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new AppError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Unauthorized", details?: unknown) {
    return new AppError(401, "UNAUTHORIZED", message, details);
  }

  static forbidden(message = "Forbidden", details?: unknown) {
    return new AppError(403, "FORBIDDEN", message, details);
  }

  static notFound(message = "Resource not found", details?: unknown) {
    return new AppError(404, "NOT_FOUND", message, details);
  }

  static conflict(message = "Conflict", details?: unknown) {
    return new AppError(409, "CONFLICT", message, details);
  }

  static validation(message = "Validation failed", details?: unknown) {
    return new AppError(422, "VALIDATION_ERROR", message, details);
  }

  static tooManyRequests(message = "Too many requests") {
    return new AppError(429, "RATE_LIMITED", message);
  }

  static internal(message = "Internal server error", details?: unknown) {
    return new AppError(500, "INTERNAL_ERROR", message, details);
  }
}
