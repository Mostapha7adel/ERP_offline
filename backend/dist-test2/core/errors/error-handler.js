import { ZodError } from "zod";
import { AppError } from "./app-error.js";
import { logger } from "../logger/logger.js";
function send(reply, statusCode, body) {
    void reply.status(statusCode).send(body);
}
/**
 * Central error handler. Maps:
 *  - AppError        → its own status/code
 *  - ZodError        → 422 VALIDATION_ERROR with flattened issues
 *  - Fastify validation → 400 BAD_REQUEST with details
 *  - anything else   → 500 (logged, generic message in production)
 */
export function errorHandler(error, request, reply) {
    if (error instanceof AppError) {
        return send(reply, error.statusCode, {
            success: false,
            error: { code: error.code, message: error.message, details: error.details },
        });
    }
    if (error instanceof ZodError) {
        return send(reply, 422, {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Validation failed",
                details: error.flatten(),
            },
        });
    }
    if (error.validation) {
        return send(reply, 400, {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: error.message ?? "Request validation failed",
                details: error.validation,
            },
        });
    }
    if (error.statusCode && error.statusCode < 500) {
        // e.g. 404 from @fastify/sensible, 429 from rate-limit, etc.
        return send(reply, error.statusCode, {
            success: false,
            error: { code: error.code ?? "REQUEST_ERROR", message: error.message },
        });
    }
    logger.error({ err: error, method: request.method, url: request.url }, "Unhandled error");
    return send(reply, 500, {
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        },
    });
}
