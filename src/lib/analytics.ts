import type {
  Invoice,
  MoneyTransaction,
  Product,
} from "@/types/domain";

export interface RevenuePoint {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface CashFlowPoint {
  label: string;
  inflow: number;
  outflow: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export interface TopProduct {
  name: string;
  sku: string;
  units: number;
  revenue: number;
  trend: number;
}

export interface KpiTrendPoint {
  label: string;
  value: number;
}

const PALETTE = [
  "hsl(243 75% 59%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(335 79% 56%)",
  "hsl(152 69% 31%)",
  "hsl(262 83% 58%)",
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isVoid = (inv: Invoice) => inv.status === "cancelled";

const monthIndex = (iso: string): number => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
};

/** Monthly revenue (sales) vs expenses (purchases) over the current year.
 * Uses paid amounts only so figures match the treasury (cash received/paid). */
export function buildRevenueSeries(invoices: Invoice[]): RevenuePoint[] {
  const sales = invoices.filter((i) => i.kind === "sale" && !isVoid(i));
  const purchases = invoices.filter((i) => i.kind === "purchase" && !isVoid(i));

  return MONTH_LABELS.map((label, m) => {
    const revenue = sales
      .filter((i) => monthIndex(i.issueDate) === m)
      .reduce((s, i) => s + i.paid, 0);
    const expenses = purchases
      .filter((i) => monthIndex(i.issueDate) === m)
      .reduce((s, i) => s + i.paid, 0);
    return { label, revenue, expenses, profit: revenue - expenses };
  });
}

/** Cash inflows/outflows across the current year's months. */
export function buildCashFlowSeries(transactions: MoneyTransaction[]): CashFlowPoint[] {
  return MONTH_LABELS.map((label, m) => {
    const inflow = transactions
      .filter((t) => t.type === "inflow" && monthIndex(t.date) === m && t.status !== "reversed")
      .reduce((s, t) => s + t.amount, 0);
    const outflow = transactions
      .filter((t) => t.type === "outflow" && monthIndex(t.date) === m && t.status !== "reversed")
      .reduce((s, t) => s + t.amount, 0);
    return { label, inflow, outflow };
  });
}

/** Expense slices from outflow treasury transactions grouped by category. */
export function buildExpenseCategories(transactions: MoneyTransaction[]): CategorySlice[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "outflow" || t.status === "reversed") continue;
    const key = t.category || "Other";
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: PALETTE[index % PALETTE.length] ?? "hsl(243 75% 59%)",
    }));
}

/** Top sold products by revenue, derived from sale invoice lines. */
export function buildTopProducts(
  invoices: Invoice[],
  products: Product[],
): TopProduct[] {
  const byProduct = new Map<string, { units: number; revenue: number }>();
  const sales = invoices.filter((i) => i.kind === "sale" && !isVoid(i));
  for (const inv of sales) {
    for (const line of inv.lines) {
      const rec = byProduct.get(line.productId) ?? { units: 0, revenue: 0 };
      rec.units += line.quantity;
      rec.revenue += line.lineTotal;
      byProduct.set(line.productId, rec);
    }
  }
  const productById = new Map(products.map((p) => [p.id, p]));
  return [...byProduct.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([id, rec]) => {
      const product = productById.get(id);
      return {
        name: product?.name ?? id,
        sku: product?.sku ?? id,
        units: rec.units,
        revenue: rec.revenue,
        trend: 0,
      };
    });
}

/** This week's sales totals by weekday. */
export function buildWeeklySales(invoices: Invoice[]): KpiTrendPoint[] {
  const sales = invoices.filter((i) => i.kind === "sale" && !isVoid(i));
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const totals = new Array(7).fill(0);
  for (const inv of sales) {
    const d = new Date(inv.issueDate);
    if (d < startOfWeek || d >= endOfWeek) continue;
    totals[d.getDay()] += inv.total;
  }
  return WEEKDAY_LABELS.map((label, i) => ({ label, value: totals[i] ?? 0 }));
}

/** Revenue and expense totals for the current (last) month. */
export function latestMonthTotals(invoices: Invoice[]): {
  revenue: number;
  expenses: number;
  profit: number;
} {
  const series = buildRevenueSeries(invoices);
  const last = series[Math.max(0, new Date().getMonth())] ?? { revenue: 0, expenses: 0, profit: 0 };
  return {
    revenue: last.revenue,
    expenses: last.expenses,
    profit: last.profit,
  };
}

/** Percentage change between the two most recent months, or 0 when there is
 *  no previous month to compare against (avoids divide-by-zero + fake trends). */
export function monthOverMonth(invoices: Invoice[]): {
  revenueTrend: number;
  expenseTrend: number;
  profitTrend: number;
} {
  const series = buildRevenueSeries(invoices);
  const month = Math.max(0, new Date().getMonth());
  const current = series[month] ?? { revenue: 0, expenses: 0, profit: 0 };
  const previous = month > 0 ? series[month - 1] ?? { revenue: 0, expenses: 0, profit: 0 } : { revenue: 0, expenses: 0, profit: 0 };

  const pct = (curr: number, prev: number) => (prev === 0 ? 0 : Math.round(((curr - prev) / Math.abs(prev)) * 100));
  return {
    revenueTrend: pct(current.revenue, previous.revenue),
    expenseTrend: pct(current.expenses, previous.expenses),
    profitTrend: pct(current.profit, previous.profit),
  };
}

/** Sales growth of this week vs the previous week (percentage). */
export function weeklySalesTrend(invoices: Invoice[]): number {
  const weekly = buildWeeklySales(invoices);
  const thisWeek = weekly.reduce((s, d) => s + d.value, 0);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfPrev = new Date(startOfWeek);
  startOfPrev.setDate(startOfWeek.getDate() - 7);

  const sales = invoices.filter((i) => i.kind === "sale" && !isVoid(i));
  let prev = 0;
  for (const inv of sales) {
    const d = new Date(inv.issueDate);
    if (d >= startOfPrev && d < startOfWeek) prev += inv.total;
  }
  if (prev === 0) return 0;
  return Math.round(((thisWeek - prev) / Math.abs(prev)) * 100);
}

/** Net profit margin as a percentage (0 when no revenue). */
export function profitMargin(invoices: Invoice[]): number {
  const { revenue, profit } = latestMonthTotals(invoices);
  if (revenue === 0) return 0;
  return Math.round((profit / revenue) * 100);
}

/** Amounts still owed on non-voided invoices.
 * - `customers`: unpaid sales invoice balances (money owed to the business).
 * - `suppliers`: unpaid purchase invoice balances (money the business owes).
 * - `total`: the two combined. */
export function buildOutstanding(invoices: Invoice[]): {
  customers: number;
  suppliers: number;
  total: number;
} {
  let customers = 0;
  let suppliers = 0;
  for (const inv of invoices) {
    if (isVoid(inv)) continue;
    const due = Math.max(0, inv.total - inv.paid);
    if (inv.kind === "sale") customers += due;
    else suppliers += due;
  }
  return { customers, suppliers, total: customers + suppliers };
}

export interface AgingBucket {
  key: string;
  label: string;
  /** Money owed to the business (unpaid customer balances) in this bucket. */
  receivables: number;
  /** Money the business owes (unpaid supplier balances) in this bucket. */
  payables: number;
  color: string;
}

/** Split outstanding balances by how overdue they are.
 * Buckets: current (< 30 days), 31-60, 61-90, 90+ days past due. */
export function buildAging(invoices: Invoice[]): AgingBucket[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const buckets: AgingBucket[] = [
    { key: "current", label: "Current", receivables: 0, payables: 0, color: "hsl(152 69% 31%)" },
    { key: "30", label: "31–60 days", receivables: 0, payables: 0, color: "hsl(199 89% 48%)" },
    { key: "60", label: "61–90 days", receivables: 0, payables: 0, color: "hsl(38 92% 50%)" },
    { key: "90", label: "90+ days", receivables: 0, payables: 0, color: "hsl(335 79% 56%)" },
  ];
  for (const inv of invoices) {
    if (isVoid(inv)) continue;
    const due = Math.max(0, inv.total - inv.paid);
    if (due <= 0) continue;
    const age = now - new Date(inv.issueDate).getTime();
    const idx = age < 30 * DAY ? 0 : age < 60 * DAY ? 1 : age < 90 * DAY ? 2 : 3;
    const bucket = buckets[idx];
    if (!bucket) continue;
    if (inv.kind === "sale") bucket.receivables += due;
    else bucket.payables += due;
  }
  return buckets;
}