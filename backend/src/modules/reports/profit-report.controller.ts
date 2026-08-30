import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { productRepository } from "../products/product.repository.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function registerProfitReportController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/reports/profit-by-product", {
    preHandler: requirePermission(PERMISSIONS["reports:read"]),
    schema: {
      description: "Profit per product report (تقرير أرباح المنتج)",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        warehouseId: z.string().optional(),
      }),
      response: {
        200: z.object({
          success: z.literal(true),
          data: z.array(z.object({
            productId: z.string(),
            productName: z.string(),
            sku: z.string().optional(),
            totalSold: z.number(),
            totalCost: z.number(),
            totalRevenue: z.number(),
            profit: z.number(),
            profitMargin: z.number(),
          })),
        }),
      },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const dateFrom = query.dateFrom ? String(query.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
    const dateTo = query.dateTo ? String(query.dateTo) : new Date().toISOString();
    const warehouseId = query.warehouseId ? String(query.warehouseId) : undefined;

    const allInvoices = await invoiceRepository.findAll();
    const salesInvoices = allInvoices.filter(
      (inv) => inv.type === "sales" && inv.status !== "void" && inv.invoiceDate >= dateFrom && inv.invoiceDate <= dateTo,
    );

    const productMap: Record<string, {
      productId: string;
      productName: string;
      sku?: string;
      totalSold: number;
      totalCost: number;
      totalRevenue: number;
    }> = {};

    for (const inv of salesInvoices) {
      if (warehouseId && inv.warehouseId !== warehouseId) continue;

      for (const line of inv.lines) {
        if (!line.productId) continue;
        const key = line.productId;

        if (!productMap[key]) {
          const product = await productRepository.findById(key);
          productMap[key] = {
            productId: key,
            productName: product?.name ?? line.productName,
            sku: product?.sku,
            totalSold: 0,
            totalCost: 0,
            totalRevenue: 0,
          };
        }

        const entry = productMap[key];
        entry.totalSold += line.quantity;

        const product = await productRepository.findById(key);
        const costPerUnit = product?.purchasePrice ?? 0;
        entry.totalCost += round2(costPerUnit * line.quantity);
        entry.totalRevenue += line.lineTotal;
      }
    }

    const results = Object.values(productMap).map((entry) => {
      const profit = round2(entry.totalRevenue - entry.totalCost);
      const profitMargin = entry.totalRevenue > 0 ? round2((profit / entry.totalRevenue) * 100) : 0;
      return {
        ...entry,
        totalSold: round2(entry.totalSold),
        totalCost: round2(entry.totalCost),
        totalRevenue: round2(entry.totalRevenue),
        profit,
        profitMargin,
      };
    }).sort((a, b) => b.profit - a.profit);

    return ok(results);
  });
}
