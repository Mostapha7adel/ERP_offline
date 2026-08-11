import { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useCustomersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useTransactionsStore } from "@/stores/treasury-store";
import {
  buildRevenueSeries,
  buildCashFlowSeries,
  buildExpenseCategories,
  buildTopProducts,
} from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { downloadCsv, printHtml, escapeHtml } from "@/lib/export";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { TrendAreaChart, GroupedBarChart, DonutChart } from "@/shared/components/charts/charts";
import { DataTable, type ColumnDef } from "@/shared/components/data-table/data-table";
import { EmptyState } from "@/shared/components/feedback/states";
import { TrendIndicator } from "@/shared/components/feedback/trend-indicator";

export function ReportsPage() {
  const loading = useSimulatedLoading(650);
  const { t } = useT();
  const customers = useCustomersStore((s) => s.items);
  const products = useProductsStore((s) => s.items);
  const inventory = useInventoryStore((s) => s.items);
  const invoices = useInvoicesStore((s) => s.items);
  const transactions = useTransactionsStore((s) => s.items);

  const revenueSeries = useMemo(() => buildRevenueSeries(invoices), [invoices]);
  const cashFlowSeries = useMemo(() => buildCashFlowSeries(transactions), [transactions]);
  const expenseCategories = useMemo(() => buildExpenseCategories(transactions), [transactions]);
  const topRows = useMemo(
    () => buildTopProducts(invoices, products).map((p, i) => ({ rank: i + 1, ...p })),
    [invoices, products],
  );

  const pnl = useMemo(() => {
    const last = revenueSeries[Math.max(0, new Date().getMonth())];
    const revenue = last?.revenue ?? 0;
    const cogs = 0;
    const overhead = last?.expenses ?? 0;
    return { revenue, cogs, grossProfit: revenue - cogs, overhead, netProfit: revenue - cogs - overhead };
  }, [revenueSeries]);

  const receivable = customers.reduce((s, c) => s + c.balance, 0);
  const customerCount = customers.length;
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.costPrice * inventory.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0),
    0,
  );

  const handleExport = async () => {
    const rows: Array<Array<string | number>> = [
      [t("Rank", "الترتيب"), t("Product", "المنتج"), t("Units sold", "الوحدات المباعة"), t("Revenue", "الإيرادات"), t("Trend", "الاتجاه")],
      ...topRows.map((p) => [p.rank, p.name, p.units, p.revenue, p.trend]),
    ];
    const saved = await downloadCsv(`report-sales-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    if (saved) toast.success(t("Report exported", "تم تصدير التقرير"));
  };

  const handlePrint = () => {
    const th = `border-bottom:2px solid #333;text-align:left;padding:6px 10px`;
    const thR = `border-bottom:2px solid #333;text-align:right;padding:6px 10px`;
    const td = `padding:6px 10px`;
    const tdR = `padding:6px 10px;text-align:right`;

    const pnlRows = [
      { label: t("Revenue", "الإيرادات"), value: pnl.revenue },
      { label: t("Cost of goods sold", "تكلفة البضاعة المباعة"), value: -pnl.cogs },
      { label: t("Gross profit", "إجمالي الربح"), value: pnl.grossProfit },
      { label: t("Operating overhead", "المصاريف التشغيلية"), value: -pnl.overhead },
      { label: t("Net profit", "صافي الربح"), value: pnl.netProfit },
    ]
      .map(
        (r) =>
          `<tr><td style="${td}">${r.label}</td><td style="${tdR}">${r.value < 0 ? `(${formatCurrency(Math.abs(r.value))})` : formatCurrency(r.value)}</td></tr>`,
      )
      .join("");

    const expenseRows = expenseCategories
      .map((c) => `<tr><td style="${td}">${escapeHtml(c.name)}</td><td style="${tdR}">${formatCurrency(c.value)}</td></tr>`)
      .join("");

    const cashRows = cashFlowSeries
      .map(
        (c) =>
          `<tr><td style="${td}">${c.label}</td><td style="${tdR}">${formatCurrency(c.inflow)}</td><td style="${tdR}">${formatCurrency(c.outflow)}</td></tr>`,
      )
      .join("");

    const productRows = topRows
      .map(
        (p) =>
          `<tr><td style="${td}">${p.rank}</td><td style="${td}">${escapeHtml(p.name)}</td><td style="${tdR}">${p.units}</td><td style="${tdR}">${formatCurrency(p.revenue)}</td><td style="${tdR}">${p.trend}%</td></tr>`,
      )
      .join("");

    const summaryItems = [
      { label: t("Accounts receivable", "حسابات القبض"), value: formatCurrency(receivable) },
      { label: t("Inventory value", "قيمة المخزون"), value: formatCurrency(inventoryValue) },
      { label: t("Total customers", "إجمالي العملاء"), value: String(customerCount) },
      {
        label: t("Avg customer balance", "متوسط رصيد العميل"),
        value: formatCurrency(customerCount ? receivable / customerCount : 0),
      },
    ]
      .map((i) => `<tr><td style="${td}">${i.label}</td><td style="${tdR}">${i.value}</td></tr>`)
      .join("");

    const section = (heading: string, body: string, pageBreak = false) => `
      <section${pageBreak ? ' style="page-break-before:always"' : ""}>
        <h2 style="margin:0 0 12px;font-size:16px">${heading}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          ${body}
        </table>
      </section>`;

    const html = `
      <h1 style="margin:0 0 4px;font-size:20px">${t("Financial Reports", "التقارير المالية")}</h1>
      <p style="margin:0 0 20px;color:#666;font-size:12px">${new Date().toLocaleDateString()}</p>
      ${section(t("Profit & Loss statement", "قائمة الأرباح والخسائر"), `<thead><tr><th style="${th}">${t("Item", "البند")}</th><th style="${thR}">${t("Amount", "المبلغ")}</th></tr></thead><tbody>${pnlRows}</tbody>`)}
      ${section(t("Expense breakdown", "تفصيل المصروفات"), `<thead><tr><th style="${th}">${t("Category", "الفئة")}</th><th style="${thR}">${t("Amount", "المبلغ")}</th></tr></thead><tbody>${expenseRows}</tbody>`, true)}
      ${section(t("Weekly cash flow", "التدفق النقدي الأسبوعي"), `<thead><tr><th style="${th}">${t("Period", "الفترة")}</th><th style="${thR}">${t("Inflow", "وارد")}</th><th style="${thR}">${t("Outflow", "صادر")}</th></tr></thead><tbody>${cashRows}</tbody>`, true)}
      ${section(t("Sales by Product", "المبيعات حسب المنتج"), `<thead><tr><th style="${th}">#</th><th style="${th}">${t("Product", "المنتج")}</th><th style="${thR}">${t("Units sold", "الوحدات المباعة")}</th><th style="${thR}">${t("Revenue", "الإيرادات")}</th><th style="${thR}">${t("Trend", "الاتجاه")}</th></tr></thead><tbody>${productRows}</tbody>`, true)}
      ${section(t("Customers Summary", "ملخص العملاء"), `<thead><tr><th style="${th}">${t("Item", "البند")}</th><th style="${thR}">${t("Value", "القيمة")}</th></tr></thead><tbody>${summaryItems}</tbody>`, true)}`;
    printHtml(t("Reports", "التقارير"), html);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Reports", "التقارير")} description={t("Financial insights and statements.", "المؤشرات المالية والقوائم المالية.")} />
        <SkeletonTable rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("Reports", "التقارير")} description={t("Generate and review financial statements.", "إنشاء ومراجعة القوائم المالية.")}>
        <Button variant="outline" onClick={handleExport}>
          <Download className="size-4" /> {t("Export", "تصدير")}
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="size-4" /> {t("Print", "طباعة")}
        </Button>
      </PageHeader>

      <Card>
        <Tabs defaultValue="pnl">
          <div className="border-b px-4 pt-3">
            <TabsList>
              <TabsTrigger value="pnl">{t("Profit & Loss", "قائمة الأرباح والخسائر")}</TabsTrigger>
              <TabsTrigger value="cash">{t("Cash Flow", "التدفق النقدي")}</TabsTrigger>
              <TabsTrigger value="sales">{t("Sales by Product", "المبيعات حسب المنتج")}</TabsTrigger>
              <TabsTrigger value="customers">{t("Customers", "العملاء")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pnl" className="mt-0 space-y-4 p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <StatementCard data={pnl} />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{t("Revenue trend", "اتجاه الإيرادات")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendAreaChart
                    data={revenueSeries}
                    xKey="label"
                    series={[{ key: "revenue", name: t("Revenue", "الإيرادات"), color: "hsl(243 75% 59%)" }]}
                    height={240}
                  />
                </CardContent>
              </Card>
            </div>
            <Card className="p-4">
              <CardTitle className="pb-2">{t("Expense breakdown", "تفصيل المصروفات")}</CardTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <DonutChart data={expenseCategories} height={220} centerValue={formatCurrency(expenseCategories.reduce((s, c) => s + c.value, 0))} centerLabel={t("Total expenses", "إجمالي المصروفات")} />
                <div className="flex flex-col justify-center space-y-2">
                  {expenseCategories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: cat.color }} />
                        <span className="text-muted-foreground">{cat.name}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="cash" className="mt-0 p-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("Weekly cash flow", "التدفق النقدي الأسبوعي")}</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupedBarChart
                  data={cashFlowSeries}
                  xKey="label"
                  bars={[
                    { key: "inflow", name: t("Inflow", "وارد"), color: "hsl(152 69% 31%)" },
                    { key: "outflow", name: t("Outflow", "صادر"), color: "hsl(335 79% 56%)" },
                  ]}
                  height={300}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales" className="mt-0 p-4">
            <DataTable columns={buildProductColumns(t)} data={topRows} pagination={false} />
          </TabsContent>

          <TabsContent value="customers" className="mt-0 p-4">
            <SummaryGrid receivable={receivable} inventoryValue={inventoryValue} customerCount={customers.length} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function StatementCard({ data }: { data: { revenue: number; cogs: number; grossProfit: number; overhead: number; netProfit: number } }) {
  const { t } = useT();
  const rows: Array<{ label: string; labelAr: string; value: number }> = [
    { label: "Revenue", labelAr: "الإيرادات", value: data.revenue },
    { label: "Cost of goods sold", labelAr: "تكلفة البضاعة المباعة", value: -data.cogs },
    { label: "Gross profit", labelAr: "إجمالي الربح", value: data.grossProfit },
    { label: "Operating overhead", labelAr: "المصاريف التشغيلية", value: -data.overhead },
    { label: "Net profit", labelAr: "صافي الربح", value: data.netProfit },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t("Profit & Loss statement", "قائمة الأرباح والخسائر")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
            <span className="text-muted-foreground">{t(row.label, row.labelAr)}</span>
            <span className="font-medium tabular-nums">{row.value < 0 ? `(${formatCurrency(Math.abs(row.value))})` : formatCurrency(row.value)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium">{t("Net profit", "صافي الربح")}</span>
          <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-sm font-semibold text-success">
            {formatCurrency(data.netProfit)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryGrid({ receivable, inventoryValue, customerCount }: { receivable: number; inventoryValue: number; customerCount: number }) {
  const { t } = useT();
  const items = [
    { label: "Accounts receivable", labelAr: "حسابات القبض", value: formatCurrency(receivable) },
    { label: "Inventory value", labelAr: "قيمة المخزون", value: formatCurrency(inventoryValue) },
    { label: "Total customers", labelAr: "إجمالي العملاء", value: String(customerCount) },
    { label: "Avg customer balance", labelAr: "متوسط رصيد العميل", value: formatCurrency(customerCount ? receivable / customerCount : 0) },
  ];
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label} className="p-5">
            <p className="text-sm text-muted-foreground">{t(item.label, item.labelAr)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <EmptyState title={t("Customer ledger", "دفتر العملاء")} description={t("Open invoices per customer will appear here.", "ستظهر هنا الفواتير المفتوحة لكل عميل.")} />
      </div>
    </div>
  );
}

interface ProductRow {
  rank: number;
  name: string;
  sku: string;
  units: number;
  revenue: number;
  trend: number;
}

function buildProductColumns(t: TranslateFn): ColumnDef<ProductRow, any>[] {
  return [
    {
      accessorKey: "rank",
      header: "#",
      cell: (info) => <span className="text-muted-foreground">{String(info.getValue())}</span>,
    },
    {
      accessorKey: "name",
      header: t("Product", "المنتج"),
      cell: (info) => <span className="font-medium">{String(info.row.original.name)}</span>,
    },
    {
      accessorKey: "units",
      header: t("Units sold", "الوحدات المباعة"),
      cell: (info) => <span className="tabular-nums">{String(info.getValue())}</span>,
    },
    {
      accessorKey: "revenue",
      header: t("Revenue", "الإيرادات"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "trend",
      header: t("Trend", "الاتجاه"),
      cell: (info) => <TrendIndicator value={Number(info.getValue())} className="text-xs" />,
    },
  ];
}