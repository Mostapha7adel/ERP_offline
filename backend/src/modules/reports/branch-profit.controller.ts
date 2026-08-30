import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function registerBranchProfitController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);

  typed.get("/reports/branch-profit", {
    preHandler: read,
    schema: {
      description: "Profit by branch/cost center report",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        costCenterId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const companyId = await getDefaultCompanyId();
    const db = getDb();
    const dateFrom = q.dateFrom ? String(q.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
    const dateTo = q.dateTo ? String(q.dateTo) : new Date().toISOString();
    const costCenterFilter = q.costCenterId ? String(q.costCenterId) : undefined;

    // Get all posted journal details in the date range, grouped by costCenterId
    const details = await db.journalDetail.findMany({
      where: {
        deletedAt: null,
        costCenterId: costCenterFilter ? costCenterFilter : { not: null },
        journal: {
          companyId,
          status: "posted",
          date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
      orderBy: { journal: { date: "asc" } },
    });

    // Group by cost center
    const branches: Record<string, {
      costCenterId: string;
      costCenterCode: string;
      costCenterName: string;
      revenue: number;
      expenses: number;
      profit: number;
      transactions: number;
    }> = {};

    for (const d of details) {
      const ccId = d.costCenterId ?? "unassigned";
      if (!branches[ccId]) {
        branches[ccId] = {
          costCenterId: ccId,
          costCenterCode: d.costCenter?.code ?? "N/A",
          costCenterName: d.costCenter?.name ?? "Unassigned",
          revenue: 0,
          expenses: 0,
          profit: 0,
          transactions: 0,
        };
      }

      const amount = d.debit - d.credit;
      branches[ccId].transactions += 1;

      if (d.account.type === "revenue") {
        // Revenue: credit balance is normal, so positive credit = revenue
        branches[ccId].revenue += -amount; // revenue is credit-positive
      } else if (d.account.type === "expense") {
        // Expense: debit balance is normal
        branches[ccId].expenses += amount;
      }
    }

    const results = Object.values(branches).map((b) => ({
      ...b,
      revenue: round2(b.revenue),
      expenses: round2(b.expenses),
      profit: round2(b.revenue - b.expenses),
      profitMargin: b.revenue > 0 ? round2(((b.revenue - b.expenses) / b.revenue) * 100) : 0,
    })).sort((a, b) => b.profit - a.profit);

    const totalRevenue = round2(results.reduce((s, r) => s + r.revenue, 0));
    const totalExpenses = round2(results.reduce((s, r) => s + r.expenses, 0));

    return ok({
      period: { from: dateFrom, to: dateTo },
      summary: {
        totalRevenue,
        totalExpenses,
        totalProfit: round2(totalRevenue - totalExpenses),
        branchCount: results.length,
      },
      branches: results,
    });
  });
}
