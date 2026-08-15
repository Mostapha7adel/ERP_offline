import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { fiscalYearService } from "./fiscal-year.service.js";
import { accountingService } from "./accounting.service.js";
import { fiscalYearSchema, fiscalYearCreateSchema } from "./fiscal-year.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerFiscalYearController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/accounting/fiscal-years", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "List fiscal years with computed P&L balances",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()) }) },
    },
  }, async () => {
    return ok(await fiscalYearService.list());
  });

  typed.post("/accounting/fiscal-years", {
    preHandler: requirePermission(PERMISSIONS["accounting:create"]),
    schema: {
      description: "Open a new fiscal year",
      security: [{ bearerAuth: [] }],
      body: fiscalYearCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: fiscalYearSchema }) },
    },
  }, async (request, reply) => {
    const fy = await fiscalYearService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(fy);
  });

  typed.post("/accounting/fiscal-years/:id/close", {
    preHandler: requirePermission(PERMISSIONS["accounting:update"]),
    schema: {
      description: "Close a fiscal year (P&L to retained earnings + lock the period)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: fiscalYearSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await fiscalYearService.close(id, getAuditContext(request)));
  });
}

export { accountingService };
