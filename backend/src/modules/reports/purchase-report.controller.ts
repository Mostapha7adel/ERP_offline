import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function registerPurchaseReportController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);

  // --- Purchase by Supplier ---
  typed.get("/reports/purchase-by-supplier", {
    preHandler: read,
    schema: {
      description: "Purchase report grouped by supplier",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const companyId = await getDefaultCompanyId();
    const db = getDb();
    const dateFrom = q.dateFrom ? String(q.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
    const dateTo = q.dateTo ? String(q.dateTo) : new Date().toISOString();
    const limit = Number(q.limit ?? 10);

    const invoices = await db.invoice.findMany({
      where: {
        companyId,
        type: "purchase",
        status: { not: "void" },
        invoiceDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      include: { supplier: { select: { id: true, name: true } } },
    });

    const grouped: Record<string, { supplierId: string; supplierName: string; count: number; total: number; subtotal: number; tax: number }> = {};
    for (const inv of invoices) {
      const key = inv.supplierId ?? "unknown";
      if (!grouped[key]) {
        grouped[key] = {
          supplierId: inv.supplierId ?? "",
          supplierName: inv.supplier?.name ?? "Unknown",
          count: 0,
          total: 0,
          subtotal: 0,
          tax: 0,
        };
      }
      grouped[key].count += 1;
      grouped[key].total += inv.total;
      grouped[key].subtotal += inv.subtotal;
      grouped[key].tax += inv.tax;
    }

    const results = Object.values(grouped)
      .map((s) => ({
        ...s,
        total: round2(s.total),
        subtotal: round2(s.subtotal),
        tax: round2(s.tax),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return ok({ period: { from: dateFrom, to: dateTo }, data: results });
  });

  // --- Purchase by Category ---
  typed.get("/reports/purchase-by-category", {
    preHandler: read,
    schema: {
      description: "Purchase report grouped by product category",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const companyId = await getDefaultCompanyId();
    const db = getDb();
    const dateFrom = q.dateFrom ? String(q.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
    const dateTo = q.dateTo ? String(q.dateTo) : new Date().toISOString();
    const limit = Number(q.limit ?? 10);

    const invoices = await db.invoice.findMany({
      where: {
        companyId,
        type: "purchase",
        status: { not: "void" },
        invoiceDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      include: {
        lines: { include: { product: { select: { id: true, name: true, categoryId: true } } } },
      },
    });

    const grouped: Record<string, { categoryId: string; categoryName: string; quantity: number; total: number }> = {};
    for (const inv of invoices) {
      for (const line of inv.lines) {
        const catId = line.product?.categoryId ?? "uncategorized";
        if (!grouped[catId]) {
          grouped[catId] = { categoryId: catId, categoryName: catId === "uncategorized" ? "Uncategorized" : catId, quantity: 0, total: 0 };
        }
        grouped[catId].quantity += line.quantity;
        grouped[catId].total += line.lineTotal;
      }
    }

    // Resolve category names
    const catIds = Object.keys(grouped).filter((id) => id !== "uncategorized");
    if (catIds.length > 0) {
      const cats = await db.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      for (const id of catIds) {
        if (grouped[id]) grouped[id].categoryName = catMap.get(id) ?? id;
      }
    }

    const results = Object.values(grouped)
      .map((c) => ({ ...c, total: round2(c.total), quantity: round2(c.quantity) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return ok({ period: { from: dateFrom, to: dateTo }, data: results });
  });

  // --- Purchase Trend ---
  typed.get("/reports/purchase-trend", {
    preHandler: read,
    schema: {
      description: "Purchase trend over time (monthly aggregation)",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const companyId = await getDefaultCompanyId();
    const db = getDb();
    const dateFrom = q.dateFrom ? String(q.dateFrom) : new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString();
    const dateTo = q.dateTo ? String(q.dateTo) : new Date().toISOString();

    const invoices = await db.invoice.findMany({
      where: {
        companyId,
        type: "purchase",
        status: { not: "void" },
        invoiceDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      select: { invoiceDate: true, total: true, subtotal: true, tax: true },
    });

    const monthly: Record<string, { month: string; count: number; total: number; subtotal: number; tax: number }> = {};
    for (const inv of invoices) {
      const key = inv.invoiceDate.toISOString().slice(0, 7);
      if (!monthly[key]) {
        monthly[key] = { month: key, count: 0, total: 0, subtotal: 0, tax: 0 };
      }
      monthly[key].count += 1;
      monthly[key].total += inv.total;
      monthly[key].subtotal += inv.subtotal;
      monthly[key].tax += inv.tax;
    }

    const results = Object.values(monthly)
      .map((m) => ({
        ...m,
        total: round2(m.total),
        subtotal: round2(m.subtotal),
        tax: round2(m.tax),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return ok({ period: { from: dateFrom, to: dateTo }, data: results });
  });
}
