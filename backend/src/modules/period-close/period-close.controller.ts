import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { periodCloseService } from "./period-close.service.js";
import { periodCloseSchema, closePeriodSchema, openPeriodSchema } from "./period-close.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerPeriodCloseController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/period-close", {
    preHandler: requirePermission(PERMISSIONS["period-close:read"]),
    schema: {
      description: "List all accounting periods with status",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(periodCloseSchema) }) },
    },
  }, async () => {
    return ok(await periodCloseService.list());
  });

  typed.get("/period-close/:period", {
    preHandler: requirePermission(PERMISSIONS["period-close:read"]),
    schema: {
      description: "Get a specific accounting period",
      security: [{ bearerAuth: [] }],
      params: z.object({ period: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: periodCloseSchema }) },
    },
  }, async (request) => {
    const { period } = request.params as { period: string };
    return ok(await periodCloseService.getByPeriod(period));
  });

  typed.post("/period-close/close", {
    preHandler: requirePermission(PERMISSIONS["period-close:manage"]),
    schema: {
      description: "Close an accounting period",
      security: [{ bearerAuth: [] }],
      body: closePeriodSchema,
      response: { 200: z.object({ success: z.literal(true), data: periodCloseSchema }) },
    },
  }, async (request) => {
    return ok(await periodCloseService.close(request.body as z.infer<typeof closePeriodSchema>, getAuditContext(request)));
  });

  typed.post("/period-close/open", {
    preHandler: requirePermission(PERMISSIONS["period-close:manage"]),
    schema: {
      description: "Reopen the most recently closed accounting period",
      security: [{ bearerAuth: [] }],
      body: openPeriodSchema,
      response: { 200: z.object({ success: z.literal(true), data: periodCloseSchema }) },
    },
  }, async (request) => {
    return ok(await periodCloseService.open(request.body as z.infer<typeof openPeriodSchema>, getAuditContext(request)));
  });
}
