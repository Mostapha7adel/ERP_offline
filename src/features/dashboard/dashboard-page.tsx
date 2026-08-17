import {
  Wallet, TrendingUp, Receipt, CircleDollarSign,
  ArrowDownRight, ArrowUpRight, Package, Clock,
} from "lucide-react";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useProductsStore } from "@/stores/products-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useTransactionsStore } from "@/stores/treasury-store";
import { formatCurrency, formatCompact, formatDate } from "@/lib/format";
import {
  buildRevenueSeries,
  buildCashFlowSeries,
  buildExpenseCategories,
  buildTopProducts,
  buildWeeklySales,
  buildOutstanding,
  buildAging,
  latestMonthTotals,
  monthOverMonth,
  weeklySalesTrend,
  profitMargin,
} from "@/lib/analytics";
import { PageHeader } from "@/shared/components/layout/page-header";
import { StatCard } from "@/shared/components/layout/stat-card";
import { TrendIndicator } from "@/shared/components/feedback/trend-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { SkeletonCards, SkeletonTable } from "@/shared/components/feedback/skeletons";
import { StateShell } from "@/shared/components/feedback/states";
import { TrendAreaChart, GroupedBarChart, DonutChart, MiniArea } from "@/shared/components/charts/charts";
import { useNavigate } from "react-router-dom";
import { initials } from "@/lib/utils";
import { useT } from "@/shared/lib/i18n";

export function DashboardPage() {
  const loading = useSimulatedLoading(750);
  const products = useProductsStore((s) => s.items);
  const inventory = useInventoryStore((s) => s.items);
  const invoices = useInvoicesStore((s) => s.items);
  const transactions = useTransactionsStore((s) => s.items);
  const navigate = useNavigate();
  const { t } = useT();

  const lowStock = products
    .map((product) => ({
      product,
      available: inventory
        .filter((i) => i.productId === product.id)
        .reduce((s, i) => s + i.quantity, 0),
    }))
    .filter((x) => x.available <= x.product.reorderLevel)
    .sort((a, b) => a.available - b.available)
    .slice(0, 4);

  const revenueSeries = buildRevenueSeries(invoices);
  const { revenue, expenses, profit } = latestMonthTotals(invoices);
  const { revenueTrend, expenseTrend, profitTrend } = monthOverMonth(invoices);
  const salesTrend = weeklySalesTrend(invoices);
  const margin = profitMargin(invoices);
  const cashFlowSeries = buildCashFlowSeries(transactions);
  const expenseCategories = buildExpenseCategories(transactions);
  const topProducts = buildTopProducts(invoices, products);
  const weeklySales = buildWeeklySales(invoices);
  const outstanding = buildOutstanding(invoices);
  const aging = buildAging(invoices);

  // Inventory value: on-hand quantity × cost price, from product + stock data.
  const inventoryValue = products.reduce((sum, product) => {
    const onHand = inventory
      .filter((i) => i.productId === product.id)
      .reduce((s, i) => s + i.quantity, 0);
    return sum + onHand * product.costPrice;
  }, 0);

  // Open invoices: non-voided, non-fully-paid documents (due from customers or
  // due to suppliers), excluding fully paid and cancelled ones.
  const openInvoices = invoices.filter((inv) => inv.status !== "cancelled" && inv.total - inv.paid > 0);
  const openReceivables = outstanding.customers;
  const openPayables = outstanding.suppliers;

  const recentInvoices = [...invoices]
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))
    .slice(0, 6);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Dashboard", "لوحة التحكم")} description={t("Overview of your company performance.", "نظرة عامة على أداء شركتك.")} />
        <SkeletonCards count={4} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 lg:col-span-2">
            <SkeletonTable rows={6} columns={3} />
          </div>
          <div className="rounded-xl border bg-card p-5">
            <SkeletonTable rows={6} columns={2} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Dashboard Overview", "نظرة عامة على لوحة التحكم")}
        description={t("Here's what's happening across your business today.", "إليك ما يحدث في أعمالك اليوم.")}
      >
        <Button variant="outline" onClick={() => navigate("/app/reports")}>
          {t("View full report", "عرض التقرير الكامل")}
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label={t("Revenue (${month})", "الإيرادات (${month})").replace("${month}", new Date().toLocaleString(undefined, { month: "short" }))}
          value={formatCurrency(revenue)}
          icon={TrendingUp}
          iconClassName="bg-success/10 text-success"
          trend={revenueTrend}
          footer={t("vs last month", "مقارنة بالشهر الماضي")}
        />
        <StatCard
          index={1}
          label={t("Expenses", "المصروفات")}
          value={formatCurrency(expenses)}
          icon={Receipt}
          iconClassName="bg-destructive/10 text-destructive"
          trend={expenseTrend}
          trendPrefix="+"
          footer={t("vs last month", "مقارنة بالشهر الماضي")}
        />
        <StatCard
          index={2}
          label={t("Net profit", "صافي الربح")}
          value={formatCurrency(profit)}
          icon={CircleDollarSign}
          iconClassName="bg-primary/10 text-primary"
          trend={profitTrend}
          footer={t("margin ${percent}%", "هامش ${percent}٪").replace("${percent}", String(margin))}
        />
        <StatCard
          index={3}
          label={t("Amount due", "المبلغ المستحق")}
          value={formatCurrency(outstanding.total)}
          icon={Wallet}
          iconClassName="bg-info/10 text-info"
          footer={t("${c} from customers, ${s} to suppliers", "${c} من العملاء، ${s} للموردين")
            .replace("${c}", formatCurrency(outstanding.customers))
            .replace("${s}", formatCurrency(outstanding.suppliers))}
        />
        <StatCard
          index={4}
          label={t("Inventory value", "قيمة المخزون")}
          value={formatCurrency(inventoryValue)}
          icon={Package}
          iconClassName="bg-info/10 text-info"
          footer={t("${n} products in stock", "${n} منتج بالمخزون").replace("${n}", String(products.length))}
        />
        <StatCard
          index={5}
          label={t("Open invoices", "فواتير مفتوحة")}
          value={String(openInvoices.length)}
          icon={Clock}
          iconClassName="bg-warning/10 text-warning"
          footer={t("${c} receivable · ${s} payable", "${c} مستحق لنا · ${s} مستحق علينا")
            .replace("${c}", formatCompact(openReceivables))
            .replace("${s}", formatCompact(openPayables))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("Revenue vs Expenses", "الإيرادات مقابل المصروفات")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("Monthly financial performance", "الأداء المالي الشهري")}</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <Legend color="hsl(243 75% 59%)" label={t("Revenue", "الإيرادات")} />
                <Legend color="hsl(38 92% 50%)" label={t("Expenses", "المصروفات")} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TrendAreaChart
              data={revenueSeries}
              xKey="label"
              series={[
                { key: "revenue", name: t("Revenue", "الإيرادات"), color: "hsl(243 75% 59%)" },
                { key: "expenses", name: t("Expenses", "المصروفات"), color: "hsl(38 92% 50%)" },
              ]}
              height={292}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t("Expense by category", "المصروفات حسب الفئة")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("Year to date", "منذ بداية السنة")}</p>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={expenseCategories}
              height={220}
              centerValue={formatCompact(expenses)}
              centerLabel={t("Total spend", "إجمالي الإنفاق")}
            />
            <div className="mt-2 space-y-1.5">
              {expenseCategories.slice(0, 4).map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: cat.color }} />
                    <span className="text-muted-foreground">{cat.name}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatCompact(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>{t("Cash flow", "التدفق النقدي")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("Weekly inflows and outflows", "الواردات والمصروفات الأسبوعية")}</p>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              data={cashFlowSeries}
              xKey="label"
              bars={[
                { key: "inflow", name: t("Inflow", "وارد"), color: "hsl(152 69% 31%)" },
                { key: "outflow", name: t("Outflow", "صادر"), color: "hsl(335 79% 56%)" },
              ]}
              height={260}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{t("Top products", "المنتجات الأكثر مبيعاً")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/products")}>
                {t("View all", "عرض الكل")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProducts.map((p, index) => (
              <div key={p.sku} className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                  #{index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t("${units} units", "${units} وحدة").replace("${units}", String(p.units))}</span>
                    <TrendIndicator value={p.trend} className="text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("Recent transactions", "أحدث المعاملات")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("Latest invoices and bills", "أحدث الفواتير والفواتير")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/treasury")}>
                {t("Treasury", "الخزينة")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentInvoices.length === 0 ? (
              <StateShell
                size="sm"
                title={t("No transactions yet", "لا توجد معاملات بعد")}
                description={t("Invoices you create will appear here.", "ستظهر الفواتير التي تنشئها هنا.")}
              />
            ) : (
              <div className="divide-y">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`flex size-9 items-center justify-center rounded-lg ${invoice.kind === "sale" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {invoice.kind === "sale" ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <p className="text-xs text-muted-foreground">{invoice.kind === "sale" ? t("Sale", "بيع") : t("Purchase", "شراء")} • {formatDate(invoice.issueDate)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(invoice.total)}</p>
                      <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "destructive" : "warning"} dot className="mt-0.5 px-1.5 text-[10px] capitalize">
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("This week's sales", "مبيعات هذا الأسبوع")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatCurrency(sumSales(weeklySales))}
                  </p>
                </div>
                <TrendIndicator value={salesTrend} className="text-sm" />
              </div>
              <div className="mt-3">
                <MiniArea data={weeklySales.map((d) => ({ x: d.label, y: d.value }))} height={64} color="hsl(199 89% 48%)" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("Low stock alerts", "تنبيهات انخفاض المخزون")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStock.length === 0 ? (
                <StateShell
                  size="sm"
                  title={t("All stock levels are healthy", "جميع مستويات المخزون جيدة")}
                  description={t("Products at or below their reorder level will appear here.", "ستظهر هنا المنتجات عند أو أقل من حد إعادة الطلب.")}
                />
              ) : (
                lowStock.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback>{initials(item.product.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                    </div>
                    <div className="w-16 text-end">
                      <p className={item.available < item.product.reorderLevel ? "text-destructive" : "text-muted-foreground"}>
                        {t("${count} left", "متبقي ${count}").replace("${count}", String(item.available))}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("Aging of receivables", "أعمار الذمم")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("Outstanding balances by age", "الأرصدة المستحقة حسب العمر")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {aging.map((bucket) => {
                const total = bucket.receivables + bucket.payables;
                return (
                  <div key={bucket.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: bucket.color }} />
                        <span className="text-muted-foreground">{bucket.label}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ background: bucket.color }} />
                    </div>
                    {total > 0 ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t("${c} receivable · ${s} payable", "${c} مستحق لنا · ${s} مستحق علينا")
                          .replace("${c}", formatCurrency(bucket.receivables))
                          .replace("${s}", formatCurrency(bucket.payables))}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function sumSales(data: Array<{ value: number }>): number {
  return data.reduce((sum, d) => sum + d.value, 0);
}