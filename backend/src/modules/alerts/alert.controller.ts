import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { alertService } from "./alert.service.js";
import { alertsSummarySchema } from "./alert.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerAlertsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/alerts", {
    preHandler: requirePermission(PERMISSIONS["alerts:read"]),
    schema: {
      description: "Get smart alert summary (low stock, overdue, expiring batches, recurring due)",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: alertsSummarySchema }) },
    },
  }, async () => {
    return ok(await alertService.summary());
  });

  typed.post("/alerts/notify", {
    preHandler: requirePermission(PERMISSIONS["alerts:read"]),
    schema: {
      description: "Push current alerts into the notification feed",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.object({ created: z.number() }) }) },
    },
  }, async () => {
    return ok(await alertService.notify());
  });
}