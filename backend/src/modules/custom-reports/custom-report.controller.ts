import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { AppError } from "../../core/errors/app-error.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";
import { getPrincipal } from "../../core/security/rbac.js";

export function registerCustomReportController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);
  const write = requirePermission(PERMISSIONS["reports:create"]);

  // List custom reports
  typed.get("/custom-reports", {
    preHandler: read,
    schema: {
      description: "List custom report definitions",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
        type: z.string().optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any(), meta: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const companyId = await getDefaultCompanyId();
    const db = getDb();
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 20);

    const where: Record<string, unknown> = { companyId, deletedAt: null };
    if (q.type) where.type = String(q.type);
    if (q.search) where.name = { contains: String(q.search) };

    const [items, total] = await Promise.all([
      db.customReport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.customReport.count({ where }),
    ]);

    return paginated(items, computeMeta(page, limit, total));
  });

  // Get a single custom report
  typed.get("/custom-reports/:id", {
    preHandler: read,
    schema: {
      description: "Get a custom report by ID",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const report = await db.customReport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!report) throw AppError.notFound("Custom report not found");
    return ok(report);
  });

  // Create custom report
  typed.post("/custom-reports", {
    preHandler: write,
    schema: {
      description: "Create a new custom report definition",
      security: [{ bearerAuth: [] }],
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.string(),
        config: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
      response: { 201: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request, reply) => {
    const body = request.body as { name: string; description?: string; type: string; config?: string; isPublic?: boolean };
    const companyId = await getDefaultCompanyId();
    const principal = getPrincipal(request);
    const db = getDb();

    // Check for duplicate name
    const existing = await db.customReport.findFirst({
      where: { companyId, name: body.name, deletedAt: null },
    });
    if (existing) throw AppError.conflict("A custom report with this name already exists");

    const report = await db.customReport.create({
      data: {
        companyId,
        name: body.name,
        description: body.description,
        type: body.type,
        config: body.config,
        isPublic: body.isPublic ?? false,
        createdBy: principal.sub,
      },
    });

    void reply.status(201);
    return ok(report);
  });

  // Update custom report
  typed.put("/custom-reports/:id", {
    preHandler: write,
    schema: {
      description: "Update a custom report definition",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.string().optional(),
        config: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; type?: string; config?: string; isPublic?: boolean };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const existing = await db.customReport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw AppError.notFound("Custom report not found");

    if (body.name && body.name !== existing.name) {
      const dup = await db.customReport.findFirst({
        where: { companyId, name: body.name, deletedAt: null, id: { not: id } },
      });
      if (dup) throw AppError.conflict("A custom report with this name already exists");
    }

    const report = await db.customReport.update({
      where: { id },
      data: { ...body },
    });

    return ok(report);
  });

  // Delete custom report (soft delete)
  typed.delete("/custom-reports/:id", {
    preHandler: write,
    schema: {
      description: "Delete a custom report (soft delete)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const existing = await db.customReport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw AppError.notFound("Custom report not found");

    await db.customReport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ok({ id });
  });

  // Execute a custom report
  typed.post("/custom-reports/:id/execute", {
    preHandler: read,
    schema: {
      description: "Execute a custom report and return results",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const report = await db.customReport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!report) throw AppError.notFound("Custom report not found");

    let config: Record<string, unknown> = {};
    try {
      config = report.config ? JSON.parse(report.config) as Record<string, unknown> : {};
    } catch {
      throw AppError.badRequest("Invalid report configuration JSON");
    }
    const dateFrom = config.dateFrom ? new Date(String(config.dateFrom)) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const dateTo = config.dateTo ? new Date(String(config.dateTo)) : new Date();

    // Execute based on report type
    let data: unknown = [];
    switch (report.type) {
      case "sales": {
        data = await db.invoice.findMany({
          where: { companyId, type: "sales", status: { not: "void" }, invoiceDate: { gte: dateFrom, lte: dateTo } },
        });
        break;
      }
      case "purchases": {
        data = await db.invoice.findMany({
          where: { companyId, type: "purchase", status: { not: "void" }, invoiceDate: { gte: dateFrom, lte: dateTo } },
        });
        break;
      }
      case "inventory": {
        data = await db.stockItem.findMany({
          where: { companyId, deletedAt: null },
          include: { product: { select: { name: true, sku: true } } },
        });
        break;
      }
      default: {
        data = { message: "Report type not yet supported for execution" };
      }
    }

    return ok({ report: { id: report.id, name: report.name, type: report.type }, data });
  });
}
