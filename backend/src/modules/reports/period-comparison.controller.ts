import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface PeriodData {
  revenue: number;
  expenses: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

async function buildPeriodData(db: ReturnType<typeof getDb>, companyId: string, from: Date, to: Date): Promise<PeriodData> {
  // P&L from invoices
  const invoices = await db.invoice.findMany({
    where: {
      companyId,
      status: { not: "void" },
      invoiceDate: { gte: from, lte: to },
    },
    select: { type: true, subtotal: true, total: true, tax: true },
  });

  const sales = invoices.filter((i) => i.type === "sales");
  const purchases = invoices.filter((i) => i.type === "purchase");
  const revenue = round2(sales.reduce((s, i) => s + i.subtotal, 0));
  const cogs = round2(purchases.reduce((s, i) => s + i.subtotal, 0));

  // Expenses from treasury
  const treasuryTxns = await db.treasuryTransaction.findMany({
    where: {
      companyId,
      type: "expense",
      date: { gte: from, lte: to },
      deletedAt: null,
    },
    select: { amount: true },
  });
  const expenses = round2(treasuryTxns.reduce((s, t) => s + t.amount, 0));
  const netProfit = round2(revenue - cogs - expenses);

  // Balance sheet from accounts
  const accounts = await db.account.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: { id: true, type: true, openingBalance: true },
  });

  // Get journal detail balances for the period up to `to`
  const details = await db.journalDetail.findMany({
    where: {
      deletedAt: null,
      journal: { companyId, status: "posted", date: { lte: to } },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const accountBalanceMap: Record<string, number> = {};
  for (const d of details) {
    accountBalanceMap[d.accountId] = (accountBalanceMap[d.accountId] ?? 0) + d.debit - d.credit;
  }

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const acc of accounts) {
    const balance = (acc.openingBalance ?? 0) + (accountBalanceMap[acc.id] ?? 0);
    switch (acc.type) {
      case "asset": totalAssets += balance; break;
      case "liability": totalLiabilities += balance; break;
      case "equity": totalEquity += balance; break;
      case "revenue": totalEquity += balance; break; // revenue increases equity
      case "expense": totalEquity -= balance; break; // expense decreases equity
    }
  }

  return {
    revenue,
    expenses,
    netProfit,
    totalAssets: round2(totalAssets),
    totalLiabilities: round2(totalLiabilities),
    totalEquity: round2(totalEquity),
  };
}

export function registerPeriodComparisonController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);

  typed.get("/reports/period-comparison", {
    preHandler: read,
    schema: {
      description: "Side-by-side P&L and Balance Sheet comparison for two periods",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        period1Start: z.string(),
        period1End: z.string(),
        period2Start: z.string(),
        period2End: z.string(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as { period1Start: string; period1End: string; period2Start: string; period2End: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const [period1, period2] = await Promise.all([
      buildPeriodData(db, companyId, new Date(q.period1Start), new Date(q.period1End)),
      buildPeriodData(db, companyId, new Date(q.period2Start), new Date(q.period2End)),
    ]);

    const pctChange = (a: number, b: number) => a !== 0 ? round2(((b - a) / Math.abs(a)) * 100) : 0;

    return ok({
      period1: { from: q.period1Start, to: q.period1End, ...period1 },
      period2: { from: q.period2Start, to: q.period2End, ...period2 },
      changes: {
        revenue: { absolute: round2(period2.revenue - period1.revenue), percent: pctChange(period1.revenue, period2.revenue) },
        expenses: { absolute: round2(period2.expenses - period1.expenses), percent: pctChange(period1.expenses, period2.expenses) },
        netProfit: { absolute: round2(period2.netProfit - period1.netProfit), percent: pctChange(period1.netProfit, period2.netProfit) },
        totalAssets: { absolute: round2(period2.totalAssets - period1.totalAssets), percent: pctChange(period1.totalAssets, period2.totalAssets) },
        totalLiabilities: { absolute: round2(period2.totalLiabilities - period1.totalLiabilities), percent: pctChange(period1.totalLiabilities, period2.totalLiabilities) },
        totalEquity: { absolute: round2(period2.totalEquity - period1.totalEquity), percent: pctChange(period1.totalEquity, period2.totalEquity) },
      },
    });
  });
}
