import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { budgetService } from "./budget.service.js";
import { budgetCreateSchema, budgetUpdateSchema, budgetSchema } from "./budget.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerBudgetsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: budgetSchema });

  typed.get("/budgets", {
    preHandler: requirePermission(PERMISSIONS["budgets:read"]),
    schema: {
      description: "List budgets",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(budgetSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await budgetService.list(options);
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/budgets/actuals", {
    preHandler: requirePermission(PERMISSIONS["budgets:read"]),
    schema: {
      description: "Compare budgeted vs actual spending per account for a period",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ period: z.string().regex(/^\d{4}(-Q[1-4]|-\d{2})$/, "Period must be YYYY-MM or YYYY-Qn") }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { period } = request.query as { period: string };
    const actuals = await budgetService.getActuals(period);
    const totalBudgeted = actuals.reduce((s, a) => s + a.budgeted, 0);
    const totalActual = actuals.reduce((s, a) => s + a.actual, 0);
    return ok({
      period,
      summary: {
        totalBudgeted,
        totalActual,
        totalVariance: Math.round((totalBudgeted - totalActual) * 100) / 100,
      },
      accounts: actuals,
    });
  });

  typed.get("/budgets/:id", {
    preHandler: requirePermission(PERMISSIONS["budgets:read"]),
    schema: {
      description: "Get budget by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await budgetService.getById(id));
  });

  typed.post("/budgets", {
    preHandler: requirePermission(PERMISSIONS["budgets:create"]),
    schema: {
      description: "Create a budget",
      security: [{ bearerAuth: [] }],
      body: budgetCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const budget = await budgetService.create(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(budget);
  });

  typed.patch("/budgets/:id", {
    preHandler: requirePermission(PERMISSIONS["budgets:update"]),
    schema: {
      description: "Update a budget",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: budgetUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await budgetService.update(id, request.body as any, getAuditContext(request)));
  });

  typed.delete("/budgets/:id", {
    preHandler: requirePermission(PERMISSIONS["budgets:delete"]),
    schema: {
      description: "Delete a budget",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await budgetService.delete(id, getAuditContext(request)));
  });
}
