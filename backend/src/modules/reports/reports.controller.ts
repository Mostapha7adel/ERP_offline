import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { stockItemRepository } from "../inventory/inventory.repository.js";
import { treasuryTransactionRepository, treasuryAccountRepository } from "../treasury/treasury.repository.js";
import { noteRepository } from "../notes/note.repository.js";
import { accountingService } from "../accounting/accounting.service.js";
import { AppError } from "../../core/errors/app-error.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

function dateRange(query: Record<string, unknown>) {
  const from = query.from ? String(query.from) : new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
  const to = query.to ? String(query.to) : new Date().toISOString();
  return { from, to };
}

export function registerReportsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);

  typed.get("/reports/sales", {
    preHandler: read,
    schema: {
      description: "Sales report (total, by product, by customer)",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ from: z.string().optional(), to: z.string().optional(), groupBy: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { from, to } = dateRange(request.query as Record<string, unknown>);
    const all = await invoiceRepository.findAll();
    const invoices = all.filter(
      (inv) => inv.type === "sales" && inv.status !== "void" && inv.invoiceDate >= from && inv.invoiceDate <= to,
    );

    const totalRevenue = round2(invoices.reduce((s, inv) => s + inv.total, 0));
    const totalTax = round2(invoices.reduce((s, inv) => s + inv.tax, 0));
    const count = invoices.length;

    const byProduct: Record<string, { productId?: string; name: string; quantity: number; revenue: number }> = {};
    for (const inv of invoices) {
      for (const line of inv.lines) {
        const key = line.productId ?? line.productName;
        const entry = byProduct[key] ?? { productId: line.productId, name: line.productName, quantity: 0, revenue: 0 };
        entry.quantity += line.quantity;
        entry.revenue += line.lineTotal;
        byProduct[key] = entry;
      }
    }

    const byCustomer: Record<string, { name: string; count: number; total: number }> = {};
    for (const inv of invoices) {
      const customer = inv.customerId ? await partyRepository.findById(inv.customerId) : undefined;
      const name = customer?.name ?? "Unknown";
      const entry = byCustomer[name] ?? { name, count: 0, total: 0 };
      entry.count += 1;
      entry.total += inv.total;
      byCustomer[name] = entry;
    }

    return ok({
      period: { from, to },
      summary: { count, totalRevenue, totalTax, averageInvoice: count ? round2(totalRevenue / count) : 0 },
      topProducts: Object.values(byProduct).map((p) => ({ ...p, quantity: round2(p.quantity), revenue: round2(p.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      byCustomer: Object.values(byCustomer).map((c) => ({ ...c, total: round2(c.total) })).sort((a, b) => b.total - a.total),
    });
  });

  typed.get("/reports/purchases", {
    preHandler: read,
    schema: {
      description: "Purchase report",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ from: z.string().optional(), to: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { from, to } = dateRange(request.query as Record<string, unknown>);
    const all = await invoiceRepository.findAll();
    const invoices = all.filter(
      (inv) => inv.type === "purchase" && inv.status !== "void" && inv.invoiceDate >= from && inv.invoiceDate <= to,
    );
    const totalSpend = round2(invoices.reduce((s, inv) => s + inv.total, 0));
    const bySupplier: Record<string, { name: string; count: number; total: number }> = {};
    for (const inv of invoices) {
      const supplier = inv.supplierId ? await partyRepository.findById(inv.supplierId) : undefined;
      const name = supplier?.name ?? "Unknown";
      const entry = bySupplier[name] ?? { name, count: 0, total: 0 };
      entry.count += 1;
      entry.total += inv.total;
      bySupplier[name] = entry;
    }
    return ok({
      period: { from, to },
      summary: { count: invoices.length, totalSpend },
      bySupplier: Object.values(bySupplier).map((s) => ({ ...s, total: round2(s.total) })).sort((a, b) => b.total - a.total),
    });
  });

  typed.get("/reports/profit-loss", {
    preHandler: read,
    schema: {
      description: "Profit & Loss statement",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ from: z.string().optional(), to: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { from, to } = dateRange(request.query as Record<string, unknown>);

    const allInvoices = await invoiceRepository.findAll();
    const salesInvoices = allInvoices.filter(
      (inv) => inv.type === "sales" && inv.status !== "void" && inv.invoiceDate >= from && inv.invoiceDate <= to,
    );
    const purchaseInvoices = allInvoices.filter(
      (inv) => inv.type === "purchase" && inv.status !== "void" && inv.invoiceDate >= from && inv.invoiceDate <= to,
    );

    const revenue = round2(salesInvoices.reduce((s, inv) => s + inv.subtotal, 0));
    const taxCollected = round2(salesInvoices.reduce((s, inv) => s + inv.tax, 0));

    // COGS approximated from purchase invoices in period + stock value change.
    const cogs = round2(purchaseInvoices.reduce((s, inv) => s + inv.subtotal, 0));

    const grossProfit = round2(revenue - cogs);

    const allTreasury = await treasuryTransactionRepository.findAll();
    const expenses = allTreasury
      .filter((t) => t.type === "expense" && t.date >= from && t.date <= to)
      .reduce((s, t) => s + t.amount, 0);

    const netProfit = round2(grossProfit - expenses);

    return ok({
      period: { from, to },
      revenue,
      taxCollected,
      cogs,
      grossProfit,
      grossMargin: revenue ? round2((grossProfit / revenue) * 100) : 0,
      operatingExpenses: round2(expenses),
      netProfit,
    });
  });

  typed.get("/reports/cash-flow", {
    preHandler: read,
    schema: {
      description: "Cash flow summary from treasury transactions",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ from: z.string().optional(), to: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { from, to } = dateRange(request.query as Record<string, unknown>);
    const txns = (await treasuryTransactionRepository.findAll()).filter((t) => t.date >= from && t.date <= to);
    const inflows = round2(txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));
    const outflows = round2(txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
    const accounts = await treasuryAccountRepository.findAll();

    const byCategory: Record<string, { type: string; amount: number }> = {};
    for (const t of txns) {
      if (t.type === "transfer") continue;
      const entry = byCategory[t.category] ?? { type: t.type, amount: 0 };
      entry.amount += t.type === "income" ? t.amount : -t.amount;
      byCategory[t.category] = entry;
    }

    return ok({
      period: { from, to },
      inflows,
      outflows,
      net: round2(inflows - outflows),
      totalCashBalance: round2(accounts.reduce((s, a) => s + a.balance, 0)),
      byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v, amount: round2(v.amount) })),
    });
  });

  typed.get("/reports/inventory-valuation", {
    preHandler: read,
    schema: {
      description: "Inventory valuation report",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async () => {
    const items = await stockItemRepository.findAll();
    let totalValue = 0;
    let totalUnits = 0;
    const rows = [];
    for (const s of items) {
      const product = await productRepository.findById(s.productId);
      const value = round2(s.quantityOnHand * s.averageCost);
      totalValue += value;
      totalUnits += s.quantityOnHand;
      rows.push({
        productId: s.productId,
        sku: product?.sku,
        name: product?.name,
        quantityOnHand: s.quantityOnHand,
        averageCost: s.averageCost,
        value,
        isLowStock: s.quantityOnHand <= s.reorderLevel,
      });
    }
    return ok({ totalValue: round2(totalValue), totalUnits, items: rows });
  });

  typed.get("/reports/aging", {
    preHandler: read,
    schema: {
      description: "Receivables & payables aging report",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ type: z.enum(["receivable", "payable"]).optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const type = (request.query as Record<string, unknown>).type ?? "receivable";
    const now = Date.now();
    const bucket = (due?: string, total = 0) => {
      if (!due) return "current";
      const days = Math.floor((now - new Date(due).getTime()) / 86400000);
      if (days <= 0) return "current";
      if (days <= 30) return "1-30";
      if (days <= 60) return "31-60";
      if (days <= 90) return "61-90";
      return "90+";
    };

    const all = await invoiceRepository.findAll();
    const invoices = all.filter(
      (inv) => inv.type === (type === "receivable" ? "sales" : "purchase") && inv.status !== "void" && inv.total > inv.paidAmount,
    );

    const buckets: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const rows = [];
    for (const inv of invoices) {
      const balance = round2(inv.total - inv.paidAmount);
      const key = bucket(inv.dueDate, balance);
      buckets[key] = round2((buckets[key] ?? 0) + balance);
      const party = inv.type === "sales"
        ? (inv.customerId ? await partyRepository.findById(inv.customerId) : undefined)
        : (inv.supplierId ? await partyRepository.findById(inv.supplierId) : undefined);
      rows.push({
        invoiceId: inv.id,
        number: inv.number,
        partyName: party?.name ?? "Unknown",
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total: inv.total,
        paidAmount: inv.paidAmount,
        balance,
        bucket: key,
      });
    }

    return ok({ type, buckets, total: round2(Object.values(buckets).reduce((s, v) => s + v, 0)), rows });
  });

  typed.get("/reports/tax", {
    preHandler: read,
    schema: {
      description: "Tax summary (sales tax collected vs purchase tax paid)",
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
    const outputTax = round2(sales.reduce((s, inv) => s + inv.tax, 0));
    const inputTax = round2(purchases.reduce((s, inv) => s + inv.tax, 0));
    return ok({
      period: { from, to },
      outputTax,
      inputTax,
      netPayable: round2(outputTax - inputTax),
    });
  });

  typed.get("/reports/balance-sheet", {
    preHandler: read,
    schema: {
      description: "Balance sheet statement (assets, liabilities, equity)",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ asOf: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async () => {
    const chart = await accountingService.getChart();
    const byClass = (type: string) =>
      chart
        .filter((a) => a.type === type)
        .map((a) => ({ code: a.code, name: a.name, balance: round2(a.balance) }))
        .sort((a, b) => a.code.localeCompare(b.code));

    const assets = byClass("asset");
    const liabilities = byClass("liability");
    const equity = byClass("equity");

    const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0));
    const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0));
    const totalEquity = round2(equity.reduce((s, a) => s + a.balance, 0));

    // Retained earnings = current-period net profit when the chart doesn't yet
    // hold a closed P&L balance. We derive it from posted revenue/expense
    // accounts so the balance sheet balances.
    const revenue = round2(chart.filter((a) => a.type === "revenue").reduce((s, a) => s + a.balance, 0));
    const expenses = round2(chart.filter((a) => a.type === "expense").reduce((s, a) => s + a.balance, 0));
    const netProfit = round2(revenue - expenses);

    return ok({
      sections: {
        assets: { label: "Assets", rows: assets, total: totalAssets },
        liabilities: { label: "Liabilities", rows: liabilities, total: totalLiabilities },
        equity: { label: "Equity", rows: equity, total: totalEquity },
      },
      retainedEarnings: round2(totalEquity - netProfit),
      netProfit,
      totalAssets,
      totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
      balanced: Math.abs(totalAssets - round2(totalLiabilities + totalEquity)) < 0.01,
    });
  });

  typed.get("/reports/customer-ledger", {
    preHandler: read,
    schema: {
      description: "Open invoices per customer (customer ledger)",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ customerId: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { customerId } = request.query as Record<string, unknown>;
    const all = await invoiceRepository.findAll();
    const sales = all.filter(
      (inv) => inv.type === "sales" && inv.status !== "void",
    );
    const byCustomer: Record<string, { name: string; open: number; paid: number; invoices: Array<Record<string, unknown>> }> = {};
    for (const inv of sales) {
      const id = inv.customerId ?? "unknown";
      if (customerId && id !== customerId) continue;
      const customer = id !== "unknown" ? await partyRepository.findById(id) : undefined;
      const name = customer?.name ?? "Unknown";
      const entry = byCustomer[id] ?? { name, open: 0, paid: 0, invoices: [] };
      entry.open += inv.total - inv.paidAmount;
      entry.paid += inv.paidAmount;
      entry.invoices.push({
        id: inv.id,
        number: inv.number,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total: inv.total,
        paidAmount: inv.paidAmount,
        balance: round2(inv.total - inv.paidAmount),
        status: inv.status,
      });
      byCustomer[id] = entry;
    }
    return ok({
      customers: Object.entries(byCustomer)
        .map(([id, c]) => ({ customerId: id, name: c.name, open: round2(c.open), paid: round2(c.paid), invoices: c.invoices }))
        .sort((a, b) => b.open - a.open),
    });
  });

  typed.get("/reports/party-statement", {
    preHandler: read,
    schema: {
      description: "Customer/supplier statement (كشف حساب) with running balance across invoices, payments and notes",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ partyId: z.string(), from: z.string().optional(), to: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { from, to } = dateRange(query);
    const partyId = String(query.partyId);
    const party = await partyRepository.findById(partyId);
    if (!party) throw AppError.notFound("Party not found");
    const kind = party.type === "customer" ? "sales" : "purchase";

    // Invoice rows increase the party's balance (what they owe / we owe).
    const allInvoices = await invoiceRepository.findAll();
    const entries: Array<{ date: string; kind: string; ref: string; description: string; debit: number; credit: number }> = [];
    for (const inv of allInvoices) {
      const linked = party.type === "customer" ? inv.customerId === party.id : inv.supplierId === party.id;
      if (inv.type === kind && inv.status !== "void" && linked) {
        entries.push({
          date: inv.invoiceDate,
          kind: "invoice",
          ref: inv.number,
          description: inv.type === "sales" ? "Sales invoice" : "Purchase invoice",
          debit: round2(inv.total),
          credit: 0,
        });
      }
    }

    // Payments reduce the balance (money in from customers / out to suppliers).
    for (const t of await treasuryTransactionRepository.findAll()) {
      const isPayment =
        (party.type === "customer" && t.type === "income") ||
        (party.type === "supplier" && t.type === "expense");
      if (isPayment && t.partyId === party.id) {
        entries.push({
          date: t.date,
          kind: "payment",
          ref: t.reference ?? "",
          description: t.description ?? "",
          debit: 0,
          credit: round2(t.amount),
        });
      }
    }

    // Credit notes reduce, debit notes increase.
    for (const n of await noteRepository.byParty(party.id, kind)) {
      entries.push({
        date: n.noteDate,
        kind: n.noteType === "credit" ? "credit-note" : "debit-note",
        ref: n.number,
        description: n.noteType === "credit" ? "Credit note" : "Debit note",
        debit: n.noteType === "debit" ? round2(n.total) : 0,
        credit: n.noteType === "credit" ? round2(n.total) : 0,
      });
    }

    const order = { "invoice": 0, "debit-note": 1, "credit-note": 2, "payment": 3 };
    const sortEntries = (a: { date: string; kind: string }, b: { date: string; kind: string }) =>
      a.date.localeCompare(b.date) || (order[a.kind as keyof typeof order] ?? 9) - (order[b.kind as keyof typeof order] ?? 9);

    const opening = round2(entries.filter((e) => e.date < from).reduce((s, e) => s + e.debit - e.credit, 0));
    let running = opening;
    const rows = entries
      .filter((e) => e.date >= from && e.date <= to)
      .sort(sortEntries)
      .map((e) => {
        running = round2(running + e.debit - e.credit);
        return { ...e, runningBalance: running };
      });

    return ok({
      party: { id: party.id, name: party.name, type: party.type },
      period: { from, to },
      openingBalance: opening,
      closingBalance: running,
      rows,
    });
  });

  typed.get("/reports/dashboard", {
    preHandler: read,
    schema: {
      description: "Aggregated KPIs for the dashboard",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async () => {
    const sales = (await invoiceRepository.findAll()).filter((inv) => inv.type === "sales" && inv.status !== "void");
    const purchases = (await invoiceRepository.findAll()).filter((inv) => inv.type === "purchase" && inv.status !== "void");
    const customers = (await partyRepository.findAll()).filter((p) => p.type === "customer");
    const products = await productRepository.findAll();
    const stockItems = await stockItemRepository.findAll();
    const treasuryAccounts = await treasuryAccountRepository.findAll();

    const revenue = round2(sales.reduce((s, inv) => s + inv.total, 0));
    const receivables = round2(sales.filter((inv) => inv.total > inv.paidAmount).reduce((s, inv) => s + inv.total - inv.paidAmount, 0));
    const payables = round2(purchases.filter((inv) => inv.total > inv.paidAmount).reduce((s, inv) => s + inv.total - inv.paidAmount, 0));
    const stockValue = round2(stockItems.reduce((s, item) => s + item.quantityOnHand * item.averageCost, 0));
    const cashBalance = round2(treasuryAccounts.reduce((s, a) => s + a.balance, 0));
    const lowStock = stockItems.filter((s) => s.quantityOnHand <= s.reorderLevel && s.reorderLevel > 0).length;

    const monthly: Record<string, { month: string; revenue: number }> = {};
    for (const inv of sales) {
      const key = inv.invoiceDate.slice(0, 7);
      const entry = monthly[key] ?? { month: key, revenue: 0 };
      entry.revenue += inv.total;
      monthly[key] = entry;
    }

    const recentInvoices = [];
    for (const inv of sales.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).slice(0, 5)) {
      const customer = inv.customerId ? await partyRepository.findById(inv.customerId) : undefined;
      recentInvoices.push({ id: inv.id, number: inv.number, invoiceDate: inv.invoiceDate, total: inv.total, status: inv.status, customerName: customer?.name });
    }

    return ok({
      kpis: {
        revenue,
        receivables,
        payables,
        stockValue,
        cashBalance,
        lowStockCount: lowStock,
        customerCount: customers.length,
        productCount: products.length,
        openInvoices: sales.filter((inv) => inv.total > inv.paidAmount).length,
      },
      monthlyRevenue: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
      recentInvoices,
    });
  });
}
