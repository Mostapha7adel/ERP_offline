import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { AppError } from "../../core/errors/app-error.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { requirePermission, getPrincipal } from "../../core/security/rbac.js";

export function registerScheduledReportController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);
  const write = requirePermission(PERMISSIONS["reports:create"]);

  // List scheduled reports
  typed.get("/scheduled-reports", {
    preHandler: read,
    schema: {
      description: "List scheduled report configurations",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
        isActive: z.coerce.boolean().optional(),
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
    if (q.isActive !== undefined) where.isActive = q.isActive === true || q.isActive === "true";

    const [items, total] = await Promise.all([
      db.scheduledReport.findMany({
        where,
        include: { customReport: { select: { id: true, name: true, type: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.scheduledReport.count({ where }),
    ]);

    return paginated(items, computeMeta(page, limit, total));
  });

  // Get a single scheduled report
  typed.get("/scheduled-reports/:id", {
    preHandler: read,
    schema: {
      description: "Get a scheduled report by ID",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const report = await db.scheduledReport.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { customReport: { select: { id: true, name: true, type: true, config: true } } },
    });
    if (!report) throw AppError.notFound("Scheduled report not found");
    return ok(report);
  });

  // Create scheduled report
  typed.post("/scheduled-reports", {
    preHandler: write,
    schema: {
      description: "Create a new scheduled report",
      security: [{ bearerAuth: [] }],
      body: z.object({
        name: z.string(),
        customReportId: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        timeOfDay: z.string().optional(),
        params: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
      response: { 201: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      customReportId?: string;
      frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay?: string;
      params?: string;
      isActive?: boolean;
    };
    const companyId = await getDefaultCompanyId();
    const principal = getPrincipal(request);
    const db = getDb();

    // Check for duplicate name
    const existing = await db.scheduledReport.findFirst({
      where: { companyId, name: body.name, deletedAt: null },
    });
    if (existing) throw AppError.conflict("A scheduled report with this name already exists");

    // Validate custom report exists if provided
    if (body.customReportId) {
      const cr = await db.customReport.findFirst({
        where: { id: body.customReportId, companyId, deletedAt: null },
      });
      if (!cr) throw AppError.notFound("Custom report not found");
    }

    const report = await db.scheduledReport.create({
      data: {
        companyId,
        name: body.name,
        customReportId: body.customReportId,
        frequency: body.frequency,
        dayOfWeek: body.dayOfWeek,
        dayOfMonth: body.dayOfMonth,
        timeOfDay: body.timeOfDay ?? "09:00",
        params: body.params,
        isActive: body.isActive ?? true,
        createdBy: principal.sub,
      },
    });

    void reply.status(201);
    return ok(report);
  });

  // Update scheduled report
  typed.put("/scheduled-reports/:id", {
    preHandler: write,
    schema: {
      description: "Update a scheduled report",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().optional(),
        customReportId: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
        dayOfWeek: z.number().optional(),
        dayOfMonth: z.number().optional(),
        timeOfDay: z.string().optional(),
        params: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      customReportId?: string;
      frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay?: string;
      params?: string;
      isActive?: boolean;
    };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const existing = await db.scheduledReport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw AppError.notFound("Scheduled report not found");

    if (body.name && body.name !== existing.name) {
      const dup = await db.scheduledReport.findFirst({
        where: { companyId, name: body.name, deletedAt: null, id: { not: id } },
      });
      if (dup) throw AppError.conflict("A scheduled report with this name already exists");
    }

    if (body.customReportId) {
      const cr = await db.customReport.findFirst({
        where: { id: body.customReportId, companyId, deletedAt: null },
      });
      if (!cr) throw AppError.notFound("Custom report not found");
    }

    const report = await db.scheduledReport.update({
      where: { id },
      data: { ...body },
    });

    return ok(report);
  });

  // Delete scheduled report (soft delete)
  typed.delete("/scheduled-reports/:id", {
    preHandler: write,
    schema: {
      description: "Delete a scheduled report (soft delete)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const existing = await db.scheduledReport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) throw AppError.notFound("Scheduled report not found");

    await db.scheduledReport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ok({ id });
  });

  // Run a scheduled report now
  typed.post("/scheduled-reports/:id/run-now", {
    preHandler: write,
    schema: {
      description: "Immediately execute a scheduled report",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const scheduled = await db.scheduledReport.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { customReport: true },
    });
    if (!scheduled) throw AppError.notFound("Scheduled report not found");

    // Update last run
    await db.scheduledReport.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    // If linked to a custom report, execute it
    if (scheduled.customReport) {
      const config = scheduled.customReport.config ? JSON.parse(scheduled.customReport.config) as Record<string, unknown> : {};
      const dateFrom = config.dateFrom ? new Date(String(config.dateFrom)) : new Date(new Date().setMonth(new Date().getMonth() - 12));
      const dateTo = config.dateTo ? new Date(String(config.dateTo)) : new Date();

      let data: unknown = [];
      switch (scheduled.customReport.type) {
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
        default: {
          data = { message: "Report type not yet supported for execution" };
        }
      }

      return ok({
        scheduledReport: { id: scheduled.id, name: scheduled.name },
        executedAt: new Date().toISOString(),
        data,
      });
    }

    return ok({
      scheduledReport: { id: scheduled.id, name: scheduled.name },
      executedAt: new Date().toISOString(),
      data: { message: "No linked custom report to execute" },
    });
  });
}
