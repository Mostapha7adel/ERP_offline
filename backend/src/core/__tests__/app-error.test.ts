import { describe, it, expect } from "vitest";
import { AppError } from "../errors/app-error.js";

describe("AppError factories", () => {
  it("badRequest maps to 400/BAD_REQUEST", () => {
    const err = AppError.badRequest("nope");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("nope");
  });

  it("unauthorized maps to 401/UNAUTHORIZED", () => {
    const err = AppError.unauthorized("Invalid or expired token");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("forbidden maps to 403/FORBIDDEN", () => {
    const err = AppError.forbidden("Missing permission: x");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("notFound maps to 404/NOT_FOUND", () => {
    const err = AppError.notFound("backup not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("conflict maps to 409/CONFLICT", () => {
    const err = AppError.conflict("Duplicate");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("validation maps to 422/VALIDATION_ERROR", () => {
    const err = AppError.validation("Bad payload");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("tooManyRequests maps to 429/RATE_LIMITED", () => {
    const err = AppError.tooManyRequests();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("internal maps to 500/INTERNAL_ERROR", () => {
    const err = AppError.internal("boom");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
  });

  it("preserves optional details", () => {
    const details = { field: "email" };
    const err = AppError.badRequest("x", details);
    expect(err.details).toEqual(details);
  });
});
