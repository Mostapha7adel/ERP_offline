import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error.js";
import { SUPER_ADMIN_WILDCARD } from "./permissions.js";

/**
 * Shape of the authenticated principal.
 * The `sub` is the user id; `permissions` carries the resolved role
 * permissions so route-level authorization needs no DB lookup.
 */
export interface AuthPrincipal {
  sub: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: AuthPrincipal;
  }
}

/** Load the principal from a verified JWT (set by the auth preHandler). */
export function getPrincipal(request: FastifyRequest): AuthPrincipal {
  const principal = request.principal;
  if (!principal) {
    throw AppError.unauthorized("Missing authentication");
  }
  return principal;
}

/**
 * Pre-handler factory enforcing a required permission.
 * Super admins (wildcard) bypass every check.
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = request.principal;
    if (!principal) {
      void reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing authentication" },
      });
      return;
    }
    const allowed =
      principal.permissions.includes(SUPER_ADMIN_WILDCARD) ||
      principal.permissions.includes(permission);
    if (!allowed) {
      void reply.code(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: `Missing permission: ${permission}` },
      });
      return;
    }
  };
}

/** Pre-handler enforcing a specific role (or wildcard super admin). */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = request.principal;
    if (!principal) {
      void reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing authentication" },
      });
      return;
    }
    const allowed =
      principal.permissions.includes(SUPER_ADMIN_WILDCARD) ||
      roles.includes(principal.roleName);
    if (!allowed) {
      void reply.code(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: `Role '${principal.roleName}' is not allowed` },
      });
      return;
    }
  };
}

/**
 * Pre-handler restricting a route to the super admin (wildcard) role only.
 * Used for sensitive operations such as resetting another user's password.
 */
export function requireSuperAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = request.principal;
    if (!principal) {
      void reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing authentication" },
      });
      return;
    }
    if (!principal.permissions.includes(SUPER_ADMIN_WILDCARD)) {
      void reply.code(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Only the super admin can change passwords" },
      });
      return;
    }
  };
}
