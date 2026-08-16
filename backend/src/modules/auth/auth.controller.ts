import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { createAuthService } from "./auth.service.js";
import {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginResponseSchema,
  refreshResponseSchema,
  meResponseSchema,
  simpleSuccessSchema,
  changePasswordResponseSchema,
  completeSetupResponseSchema,
} from "./auth.schema.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { getPrincipal, requireSuperAdmin } from "../../core/security/rbac.js";

export async function registerAuthController(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const service = createAuthService(app);

  // Public routes opt out of JWT auth via config.
  const publicConfig = { auth: false };

  typed.post("/auth/login", {
    config: publicConfig,
    schema: {
      description: "Authenticate and obtain tokens",
      body: loginSchema,
      response: { 200: loginResponseSchema },
    },
  }, async (request) => {
    return ok(await service.login(request.body, getAuditContext(request)));
  });

  typed.post("/auth/refresh", {
    config: publicConfig,
    schema: {
      description: "Exchange a refresh token for a new access token",
      body: refreshSchema,
      response: { 200: refreshResponseSchema },
    },
  }, async (request) => {
    return ok(await service.refresh(request.body, request.ip));
  });

  typed.post("/auth/logout", {
    schema: {
      description: "Invalidate the current refresh session",
      security: [{ bearerAuth: [] }],
      body: refreshSchema,
      response: { 200: simpleSuccessSchema },
    },
  }, async (request) => {
    await service.logout(request.body.refreshToken, getAuditContext(request));
    return ok({ success: true });
  });

  typed.get("/auth/me", {
    schema: {
      description: "Return the current authenticated principal",
      security: [{ bearerAuth: [] }],
      response: { 200: meResponseSchema },
    },
  }, async (request) => {
    return ok(getPrincipal(request));
  });

  typed.post("/auth/forgot-password", {
    config: publicConfig,
    schema: {
      description: "Reset a forgotten password (super admin only)",
      body: forgotPasswordSchema,
      response: { 200: simpleSuccessSchema },
    },
  }, async (request) => {
    return ok(await service.forgotPassword(request.body));
  });

  typed.post("/auth/change-password", {
    preHandler: requireSuperAdmin(),
    schema: {
      description: "Change the super admin's password and optionally their email",
      security: [{ bearerAuth: [] }],
      body: changePasswordSchema,
      response: { 200: changePasswordResponseSchema },
    },
  }, async (request) => {
    const principal = getPrincipal(request);
    return ok(await service.changePassword(principal.sub, request.body, getAuditContext(request)));
  });

  typed.post("/auth/complete-setup", {
    schema: {
      description: "Mark the first-run credential step as done without changing credentials",
      security: [{ bearerAuth: [] }],
      response: { 200: completeSetupResponseSchema },
    },
  }, async (request) => {
    const principal = getPrincipal(request);
    return ok(await service.completeSetup(principal.sub, getAuditContext(request)));
  });
}
