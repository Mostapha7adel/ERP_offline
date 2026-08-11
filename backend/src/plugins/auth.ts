import type { FastifyInstance } from "fastify";
import { AppError } from "../core/errors/app-error.js";
import type { AuthPrincipal } from "../core/security/rbac.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthPrincipal;
    user: AuthPrincipal;
  }
}

declare module "fastify" {
  interface FastifyContextConfig {
    /** Set to `false` on public routes to skip authentication. */
    auth?: boolean;
  }
}

/**
 * Authenticates requests via Bearer JWT and attaches the resolved principal
 * to `request.principal`. Public routes opt out with `{ config: { auth: false } }`.
 */
export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    const routeAuth = request.routeOptions.config.auth ?? true;
    if (routeAuth === false) return;
    try {
      const payload = await request.jwtVerify();
      request.principal = payload as unknown as AuthPrincipal;
    } catch {
      void reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
      });
    }
  });

  app.log.info("Auth plugin registered");
}

export { AppError };
