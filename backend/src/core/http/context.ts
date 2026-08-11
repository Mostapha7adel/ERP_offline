import type { FastifyRequest } from "fastify";
import type { AuditContext } from "../audit/audit.service.js";

/**
 * Builds the audit context for a request: authenticated principal + client IP.
 */
export function getAuditContext(request: FastifyRequest): AuditContext {
  return {
    principal: request.principal,
    ip: request.ip,
  };
}
