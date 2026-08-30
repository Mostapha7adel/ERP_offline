import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

function dateRange(query: Record<string, unknown>) {
  const from = query.from ? String(query.from) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
  const to = query.to ? String(query.to) : new Date().toISOString();
  return { from, to };
}

export function registerTaxReportController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:tax"]);

  typed.get("/reports/tax-summary", {
    preHandler: read,
    schema: {
      description: "Tax summary report: tax collected on sales vs tax paid on purchases for a date range",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ from: z.string().optional(), to: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { from, to } = dateRange(request.query as Record<string, unknown>);
    const all = await invoiceRepository.findAll();

    const sales = all.filter(
      (inv) => inv.type === "sales" && inv.status !== "void" && inv.invoiceDate >= from && inv.invoiceDate <= to,
    );
    const purchases = all.filter(
      (inv) => inv.type === "purchase" && inv.status !== "void" && inv.invoiceDate >= from && inv.invoiceDate <= to,
    );

    const taxCollected = round2(sales.reduce((s, inv) => s + inv.tax, 0));
    const taxPaid = round2(purchases.reduce((s, inv) => s + inv.tax, 0));
    const salesSubtotal = round2(sales.reduce((s, inv) => s + inv.subtotal, 0));
    const purchasesSubtotal = round2(purchases.reduce((s, inv) => s + inv.subtotal, 0));

    const byTaxRateSales: Record<number, { subtotal: number; tax: number; count: number }> = {};
    for (const inv of sales) {
      for (const line of inv.lines) {
        const rate = line.taxRate;
        const entry = byTaxRateSales[rate] ?? { subtotal: 0, tax: 0, count: 0 };
        entry.subtotal += line.lineTotal;
        entry.tax += round2(line.lineTotal * rate / 100);
        entry.count += 1;
        byTaxRateSales[rate] = entry;
      }
    }

    const byTaxRatePurchases: Record<number, { subtotal: number; tax: number; count: number }> = {};
    for (const inv of purchases) {
      for (const line of inv.lines) {
        const rate = line.taxRate;
        const entry = byTaxRatePurchases[rate] ?? { subtotal: 0, tax: 0, count: 0 };
        entry.subtotal += line.lineTotal;
        entry.tax += round2(line.lineTotal * rate / 100);
        entry.count += 1;
        byTaxRatePurchases[rate] = entry;
      }
    }

    return ok({
      period: { from, to },
      summary: {
        taxCollected,
        taxPaid,
        netTaxLiability: round2(taxCollected - taxPaid),
        salesInvoiceCount: sales.length,
        purchaseInvoiceCount: purchases.length,
        salesSubtotal,
        purchasesSubtotal,
      },
      outputTaxByRate: Object.entries(byTaxRateSales).map(([rate, v]) => ({
        taxRate: Number(rate),
        subtotal: round2(v.subtotal),
        tax: round2(v.tax),
        count: v.count,
      })),
      inputTaxByRate: Object.entries(byTaxRatePurchases).map(([rate, v]) => ({
        taxRate: Number(rate),
        subtotal: round2(v.subtotal),
        tax: round2(v.tax),
        count: v.count,
      })),
    });
  });
}
