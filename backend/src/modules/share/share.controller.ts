import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { shareService } from "./share.service.js";
import { shareRequestSchema, sharePayloadSchema } from "./share.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerShareController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post("/share", {
    preHandler: requirePermission(PERMISSIONS["share:read"]),
    schema: {
      description: "Build email / WhatsApp share payloads for an invoice or a party statement",
      security: [{ bearerAuth: [] }],
      body: shareRequestSchema,
      response: { 200: z.object({ success: z.literal(true), data: sharePayloadSchema }) },
    },
  }, async (request) => {
    return ok(await shareService.build(request.body));
  });
}