import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { currencyService } from "./currency.service.js";
import { currencyCreateSchema, currencyUpdateSchema, currencySchema } from "./currency.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerCurrenciesController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: currencySchema });

  typed.get("/currencies", {
    preHandler: requirePermission(PERMISSIONS["currencies:read"]),
    schema: {
      description: "List currency exchange rates",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(currencySchema) }) },
    },
  }, async () => {
    return ok(await currencyService.list());
  });

  typed.post("/currencies", {
    preHandler: requirePermission(PERMISSIONS["currencies:create"]),
    schema: {
      description: "Add a currency exchange rate",
      security: [{ bearerAuth: [] }],
      body: currencyCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const rate = await currencyService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(rate);
  });

  typed.patch("/currencies/:id", {
    preHandler: requirePermission(PERMISSIONS["currencies:update"]),
    schema: {
      description: "Update a currency exchange rate",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: currencyUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await currencyService.update(id, request.body, getAuditContext(request)));
  });

  typed.delete("/currencies/:id", {
    preHandler: requirePermission(PERMISSIONS["currencies:delete"]),
    schema: {
      description: "Delete a currency exchange rate",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await currencyService.delete(id, getAuditContext(request)));
  });
}