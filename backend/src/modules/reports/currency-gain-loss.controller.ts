import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function registerCurrencyGainLossController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);

  typed.get("/reports/currency-gain-loss", {
    preHandler: read,
    schema: {
      description: "Currency gain/loss report on cross-currency payments",
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
    const dateFrom = q.dateFrom ? String(q.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
    const dateTo = q.dateTo ? String(q.dateTo) : new Date().toISOString();

    // Get company base currency
    const company = await db.company.findUnique({ where: { id: companyId }, select: { currency: true } });
    const baseCurrency = company?.currency ?? "EGP";

    // Get currency rates
    const rates = await db.currencyRate.findMany({
      where: { companyId, deletedAt: null },
    });
    const rateMap = new Map(rates.map((r) => [r.code, r.rate]));

    // Get payments in the date range
    const payments = await db.invoicePayment.findMany({
      where: {
        paidAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        deletedAt: null,
        invoice: { companyId, deletedAt: null },
      },
      include: {
        invoice: {
          select: { id: true, number: true, currency: true, total: true, type: true },
        },
        account: {
          select: { id: true, name: true, currency: true },
        },
      },
      orderBy: { paidAt: "asc" },
    });

    const gainLossItems: Array<{
      paymentId: string;
      invoiceNumber: string;
      invoiceCurrency: string;
      accountCurrency: string;
      paymentAmount: number;
      invoiceAmountInBase: number;
      paymentAmountInBase: number;
      gainLoss: number;
      paidAt: string;
    }> = [];

    let totalGain = 0;
    let totalLoss = 0;

    for (const payment of payments) {
      const invoiceCurrency = payment.invoice.currency;
      const accountCurrency = payment.account.currency;
      const paymentAmount = payment.amount;

      // Convert invoice total to base currency
      const invoiceRate = rateMap.get(invoiceCurrency) ?? 1;
      const invoiceAmountInBase = round2(payment.amount * invoiceRate);

      // Convert payment amount to base currency using account currency rate
      const accountRate = rateMap.get(accountCurrency) ?? 1;
      const paymentAmountInBase = round2(paymentAmount * accountRate);

      // Gain/loss = what we received in base - what the invoice was worth in base
      // For sales: positive = gain (received more), negative = loss
      // For purchases: inverted
      const gainLoss = payment.invoice.type === "sales"
        ? round2(paymentAmountInBase - invoiceAmountInBase)
        : round2(invoiceAmountInBase - paymentAmountInBase);

      if (gainLoss > 0) totalGain += gainLoss;
      else totalLoss += Math.abs(gainLoss);

      gainLossItems.push({
        paymentId: payment.id,
        invoiceNumber: payment.invoice.number,
        invoiceCurrency,
        accountCurrency,
        paymentAmount: round2(paymentAmount),
        invoiceAmountInBase,
        paymentAmountInBase,
        gainLoss,
        paidAt: payment.paidAt.toISOString(),
      });
    }

    return ok({
      period: { from: dateFrom, to: dateTo },
      baseCurrency,
      summary: {
        totalPayments: gainLossItems.length,
        totalGain: round2(totalGain),
        totalLoss: round2(totalLoss),
        netGainLoss: round2(totalGain - totalLoss),
      },
      items: gainLossItems,
    });
  });
}
