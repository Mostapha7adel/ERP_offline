import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { importService } from "./import.service.js";
import { importProductsSchema, importPartiesSchema, importResultSchema } from "./import.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerImportController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post("/import/products", {
    preHandler: requirePermission(PERMISSIONS["import:create"]),
    schema: {
      description: "Bulk import products (upsert by sku)",
      security: [{ bearerAuth: [] }],
      body: importProductsSchema,
      response: { 201: z.object({ success: z.literal(true), data: importResultSchema }) },
    },
  }, async (request, reply) => {
    const result = await importService.importProducts(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(result);
  });

  typed.post("/import/parties", {
    preHandler: requirePermission(PERMISSIONS["import:create"]),
    schema: {
      description: "Bulk import customers/suppliers (upsert by code/email/phone)",
      security: [{ bearerAuth: [] }],
      body: importPartiesSchema,
      response: { 201: z.object({ success: z.literal(true), data: importResultSchema }) },
    },
  }, async (request, reply) => {
    const result = await importService.importParties(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(result);
  });
}