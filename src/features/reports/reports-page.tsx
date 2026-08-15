import { useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw, FileSpreadsheet } from "lucide-react";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useCustomersStore, useSuppliersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useTransactionsStore } from "@/stores/treasury-store";
import { useFiscalYearsStore } from "@/stores/fiscal-year-store";
import {
  buildRevenueSeries,
  buildCashFlowSeries,
  buildExpenseCategories,
  buildTopProducts,
} from "@/lib/analytics";
import { reportsApi } from "@/lib/api";
import type {
  ProfitLossReport,
  InventoryValuationRow,
  InventoryValuationReport,
  AgingReport,
  BalanceSheetReport,
  CustomerLedgerReport,
  TrialBalanceReport,
} from "@/lib/api";
import type { PartyStatement } from "@/types/domain";
import { formatCurrency } from "@/lib/format";
import { downloadCsv, printHtml, escapeHtml } from "@/lib/export";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { TrendAreaChart, GroupedBarChart, DonutChart } from "@/shared/components/charts/charts";
import { DataTable, type ColumnDef } from "@/shared/components/data-table/data-table";
import { EmptyState } from "@/shared/components/feedback/states";
import { TrendIndicator } from "@/shared/components/feedback/trend-indicator";
import { Combobox } from "@/shared/components/forms/combobox";

export function ReportsPage() {
  const { t } = useT();
  const customers = useCustomersStore((s) => s.items);
  const suppliers = useSuppliersStore((s) => s.items);
  const products = useProductsStore((s) => s.items);
  const inventory = useInventoryStore((s) => s.items);
  const invoices = useInvoicesStore((s) => s.items);
  const transactions = useTransactionsStore((s) => s.items);
  const fiscalYears = useFiscalYearsStore((s) => s.items);

  const [loading, setLoading] = useState(true);
  const [pnl, setPnl] = useState<ProfitLossReport | null>(null);
  const [valuation, setValuation] = useState<InventoryValuationReport | null>(null);
  const [receivableAging, setReceivableAging] = useState<AgingReport | null>(null);
  const [payableAging, setPayableAging] = useState<AgingReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerReport | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [fiscalTrialBalance, setFiscalTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [backendError, setBackendError] = useState(false);

  // Statement (كشف حساب)
  const [statement, setStatement] = useState<PartyStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementParty, setStatementParty] = useState("");
  const [statementFrom, setStatementFrom] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 11)).toISOString().slice(0, 10),
  );
  const [statementTo, setStatementTo] = useState(new Date().toISOString().slice(0, 10));

  const loadStatement = async (partyId: string, from: string, to: string) => {
    if (!partyId) return;
    setStatementLoading(true);
    try {
      setStatement(await reportsApi().partyStatement(partyId, { from, to }));
    } catch {
      setStatement(null);
    } finally {
      setStatementLoading(false);
    }
  };

  useEffect(() => {
    if (statementParty && statementFrom && statementTo) {
      void loadStatement(statementParty, statementFrom, statementTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFiscalTrialBalance = async (fiscalYearId: string) => {
    if (!fiscalYearId) {
      setFiscalTrialBalance(null);
      return;
    }
    try {
      setFiscalTrialBalance(await reportsApi().trialBalanceForFiscalYear(fiscalYearId));
    } catch {
      setFiscalTrialBalance(null);
    }
  };

  const handleFiscalYearChange = (value: string) => {
    setSelectedFiscalYear(value);
    void loadFiscalTrialBalance(value);
  };

  const handleStatementExport = async () => {
    if (!statement) return;
    const rows: Array<Array<string | number>> = [
      [
        t("Date", "التاريخ"),
        t("Description", "البيان"),
        t("Reference", "المرجع"),
        t("Debit", "مدين"),
        t("Credit", "دائن"),
        t("Balance", "الرصيد"),
      ],
      [t("Opening balance", "رصيد افتتاحي"), "", "", "", "", statement.openingBalance],
      ...statement.rows.map((r) => [r.date.slice(0, 10), r.description, r.ref, r.debit, r.credit, r.runningBalance]),
      [t("Closing balance", "رصيد ختامي"), "", "", "", "", statement.closingBalance],
    ];
    const saved = await downloadCsv(`statement-${statement.party.name}-${statement.period.from}.csv`, rows);
    if (saved) toast.success(t("Statement exported", "تم تصدير كشف الحساب"));
  };

  const handleStatementPrint = () => {
    if (!statement) return;
    const th = `border-bottom:2px solid #333;text-align:left;padding:6px 10px`;
    const thR = `border-bottom:2px solid #333;text-align:right;padding:6px 10px`;
    const td = `padding:6px 10px`;
    const tdR = `padding:6px 10px;text-align:right`;
    const rows = [
      `<tr><td style="${td}">${t("Opening balance", "رصيد افتتاحي")}</td><td style="${tdR}">${formatCurrency(statement.openingBalance)}</td></tr>`,
      ...statement.rows.map(
        (r) =>
          `<tr><td style="${td}">${r.date.slice(0, 10)}</td><td style="${td}">${escapeHtml(r.description)}</td><td style="${td}">${escapeHtml(r.ref)}</td><td style="${tdR}">${formatCurrency(r.debit)}</td><td style="${tdR}">${formatCurrency(r.credit)}</td><td style="${tdR}">${formatCurrency(r.runningBalance)}</td></tr>`,
      ),
      `<tr><td style="${td}">${t("Closing balance", "رصيد ختامي")}</td><td style="${tdR}" colspan="5">${formatCurrency(statement.closingBalance)}</td></tr>`,
    ].join("");
    const html = `
      <h1 style="margin:0 0 4px;font-size:20px">${t("Party Statement", "كشف حساب")}</h1>
      <p style="margin:0 0 4px;color:#666;font-size:12px">${escapeHtml(statement.party.name)} — ${statement.period.from} to ${statement.period.to}</p>
      <p style="margin:0 0 20px;color:#666;font-size:12px">${new Date().toLocaleDateString()}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="${th}">${t("Date", "التاريخ")}</th><th style="${th}">${t("Description", "البيان")}</th><th style="${th}">${t("Reference", "المرجع")}</th><th style="${thR}">${t("Debit", "مدين")}</th><th style="${thR}">${t("Credit", "دائن")}</th><th style="${thR}">${t("Balance", "الرصيد")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    printHtml(t("Statement", "كشف الحساب"), html);
  };

  const loadReports = async () => {
    setLoading(true);
    const range = {
      from: new Date(new Date().setMonth(new Date().getMonth() - 11)).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    };
    const results = await Promise.allSettled([
      reportsApi().profitLoss(range),
      reportsApi().cashFlow(range),
      reportsApi().sales(range),
      reportsApi().inventoryValuation(),
      reportsApi().aging("receivable"),
      reportsApi().aging("payable"),
      reportsApi().balanceSheet(),
      reportsApi().customerLedger(),
      reportsApi().trialBalance(),
    ]);
    const [p, , , iv, ar, ap, bs, cl, tb] = results;
    setPnl(p.status === "fulfilled" ? p.value : null);
    setValuation(iv.status === "fulfilled" ? iv.value : null);
    setReceivableAging(ar.status === "fulfilled" ? ar.value : null);
    setPayableAging(ap.status === "fulfilled" ? ap.value : null);
    setBalanceSheet(bs.status === "fulfilled" ? bs.value : null);
    setCustomerLedger(cl.status === "fulfilled" ? cl.value : null);
    setTrialBalance(tb.status === "fulfilled" ? tb.value : null);
    setBackendError(results.some((r) => r.status === "rejected"));
    setLoading(false);
  };

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side fallbacks used when the backend reports are unavailable and
  // when the P&L figures need reconciliation against local state.
  const revenueSeries = useMemo(() => buildRevenueSeries(invoices), [invoices]);
  const cashFlowSeries = useMemo(() => buildCashFlowSeries(transactions), [transactions]);
  const expenseCategories = useMemo(() => buildExpenseCategories(transactions), [transactions]);
  const topRows = useMemo(
    () => buildTopProducts(invoices, products).map((p, i) => ({ rank: i + 1, ...p })),
    [invoices, products],
  );

  const clientPnl = useMemo(() => {
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

  const pnlData = {
    revenue: pnl?.revenue ?? clientPnl.revenue,
    cogs: pnl?.cogs ?? clientPnl.cogs,
    grossProfit: pnl?.grossProfit ?? clientPnl.grossProfit,
    overhead: pnl?.operatingExpenses ?? clientPnl.overhead,
    netProfit: pnl?.netProfit ?? clientPnl.netProfit,
  };

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
      { label: t("Revenue", "الإيرادات"), value: pnlData.revenue },
      { label: t("Cost of goods sold", "تكلفة البضاعة المباعة"), value: -pnlData.cogs },
      { label: t("Gross profit", "إجمالي الربح"), value: pnlData.grossProfit },
      { label: t("Operating overhead", "المصاريف التشغيلية"), value: -pnlData.overhead },
      { label: t("Net profit", "صافي الربح"), value: pnlData.netProfit },
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
        <Button variant="ghost" size="icon" onClick={() => void loadReports()} title={t("Refresh", "تحديث")}>
          <RefreshCw className="size-4" />
        </Button>
      </PageHeader>

      {backendError ? (
        <Card className="border-warning/40 p-4 text-sm text-muted-foreground">
          {t("Some reports could not be fetched from the backend. Showing locally computed data where available.", "تعذر جلب بعض التقارير من الخادم. يتم عرض البيانات المحلية حيثما توفرت.")}
        </Card>
      ) : null}

      <Card>
        <Tabs defaultValue="pnl">
          <div className="border-b px-4 pt-3">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="pnl">{t("Profit & Loss", "قائمة الأرباح والخسائر")}</TabsTrigger>
              <TabsTrigger value="balance">{t("Balance Sheet", "الميزانية العمومية")}</TabsTrigger>
              <TabsTrigger value="trial">{t("Trial Balance", "ميزان المراجعة")}</TabsTrigger>
              <TabsTrigger value="cash">{t("Cash Flow", "التدفق النقدي")}</TabsTrigger>
              <TabsTrigger value="sales">{t("Sales", "المبيعات")}</TabsTrigger>
              <TabsTrigger value="aging">{t("Aging", "الأعمار")}</TabsTrigger>
              <TabsTrigger value="inventory">{t("Inventory", "المخزون")}</TabsTrigger>
              <TabsTrigger value="customers">{t("Customers", "العملاء")}</TabsTrigger>
              <TabsTrigger value="statement">{t("Statement", "كشف الحساب")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pnl" className="mt-0 space-y-4 p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <StatementCard data={pnlData} />
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

          <TabsContent value="balance" className="mt-0 p-4">
            <BalanceSheetView data={balanceSheet} />
          </TabsContent>

          <TabsContent value="trial" className="mt-0 p-4">
            {fiscalYears.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("Fiscal year", "السنة المالية")}</span>
                <Combobox
                  options={[
                    { value: "", label: t("All periods", "كل الفترات") },
                    ...fiscalYears.map((fy) => ({ value: fy.id, label: fy.name })),
                  ]}
                  value={selectedFiscalYear}
                  onValueChange={handleFiscalYearChange}
                  className="w-56"
                />
              </div>
            ) : null}
            <TrialBalanceView data={selectedFiscalYear ? fiscalTrialBalance : trialBalance} />
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

          <TabsContent value="aging" className="mt-0 p-4">
            <AgingView receivable={receivableAging} payable={payableAging} />
          </TabsContent>

          <TabsContent value="inventory" className="mt-0 p-4">
            <InventoryView data={valuation} />
          </TabsContent>

          <TabsContent value="customers" className="mt-0 p-4">
            <CustomerLedgerView data={customerLedger} receivable={receivable} inventoryValue={inventoryValue} customerCount={customers.length} />
          </TabsContent>

          <TabsContent value="statement" className="mt-0 p-4">
            <StatementView
              parties={[...customers, ...suppliers]}
              partyId={statementParty}
              onPartyChange={setStatementParty}
              from={statementFrom}
              to={statementTo}
              onFromChange={setStatementFrom}
              onToChange={setStatementTo}
              onRun={() => void loadStatement(statementParty, statementFrom, statementTo)}
              loading={statementLoading}
              data={statement}
              onExport={() => void handleStatementExport()}
              onPrint={handleStatementPrint}
            />
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

function BalanceSheetView({ data }: { data: BalanceSheetReport | null }) {
  const { t } = useT();
  if (!data) {
    return <EmptyState title={t("Balance sheet unavailable", "الميزانية غير متوفرة")} description={t("The backend could not generate the balance sheet.", "لم يتمكن الخادم من إنشاء الميزانية العمومية.")} />;
  }
  const sections = [
    { key: "assets", title: t("Assets", "الأصول"), rows: data.sections.assets.rows, total: data.sections.assets.total },
    { key: "liabilities", title: t("Liabilities", "الالتزامات"), rows: data.sections.liabilities.rows, total: data.sections.liabilities.total },
    { key: "equity", title: t("Equity", "حقوق الملكية"), rows: data.sections.equity.rows, total: data.sections.equity.total },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t("Total assets", "إجمالي الأصول")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.totalAssets)}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t("Liabilities + Equity", "الالتزامات + حقوق الملكية")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
        </div>
      </div>
      {data.balanced ? (
        <p className="text-sm text-success">{t("The balance sheet balances.", "الميزانية العمومية متوازنة.")}</p>
      ) : (
        <p className="text-sm text-destructive">{t("The balance sheet is out of balance.", "الميزانية العمومية غير متوازنة.")}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {section.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("No accounts", "لا توجد حسابات")}</p>
              ) : (
                section.rows.map((row) => (
                  <div key={row.code} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.code} — {row.name}</span>
                    <span className="tabular-nums font-medium">{formatCurrency(row.balance)}</span>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>{t("Total", "الإجمالي")}</span>
                <span className="tabular-nums">{formatCurrency(section.total)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TrialBalanceView({ data }: { data: TrialBalanceReport | null }) {
  const { t } = useT();
  if (!data) {
    return <EmptyState title={t("Trial balance unavailable", "ميزان المراجعة غير متوفر")} description={t("The backend could not generate the trial balance.", "لم يتمكن الخادم من إنشاء ميزان المراجعة.")} />;
  }
  return (
    <div className="space-y-4">
      <DataTable columns={buildTrialColumns(t)} data={data.rows} pagination={false} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t("Total debits", "إجمالي المدين")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.totalDebit)}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t("Total credits", "إجمالي الدائن")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.totalCredit)}</span>
        </div>
      </div>
    </div>
  );
}

const BUCKET_LABELS: Record<string, string> = { current: "Current", "1-30": "1-30", "31-60": "31-60", "61-90": "61-90", "90+": "90+" };

function AgingView({ receivable, payable }: { receivable: AgingReport | null; payable: AgingReport | null }) {
  const { t } = useT();
  return (
    <div className="space-y-6">
      <AgingSection
        title={t("Receivables aging", "أعمار الذمم المدينة")}
        data={receivable}
        bucketLabels={BUCKET_LABELS}
      />
      <AgingSection
        title={t("Payables aging", "أعمار الذمم الدائنة")}
        data={payable}
        bucketLabels={BUCKET_LABELS}
      />
    </div>
  );
}

function AgingSection({ title, data, bucketLabels }: { title: string; data: AgingReport | null; bucketLabels: Record<string, string> }) {
  const { t } = useT();
  if (!data) {
    return (
      <Card className="p-4">
        <CardTitle className="pb-2 text-base">{title}</CardTitle>
        <EmptyState title={t("Unavailable", "غير متوفر")} description={t("No aging data returned.", "لا توجد بيانات أعمار.")} />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-sm font-semibold tabular-nums">{t("Total", "الإجمالي")}: {formatCurrency(data.total)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-5">
          {Object.entries(bucketLabels).map(([key, label]) => (
            <div key={key} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t(label, label)}</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">{formatCurrency(data.buckets[key] ?? 0)}</p>
            </div>
          ))}
        </div>
        <DataTable columns={buildAgingColumns(t, bucketLabels)} data={data.rows} pagination={false} />
      </CardContent>
    </Card>
  );
}

function InventoryView({ data }: { data: InventoryValuationReport | null }) {
  const { t } = useT();
  if (!data) {
    return <EmptyState title={t("Inventory valuation unavailable", "تقييم المخزون غير متوفر")} description={t("No inventory data returned.", "لا توجد بيانات مخزون.")} />;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t("Total inventory value", "إجمالي قيمة المخزون")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.totalValue)}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <span className="text-sm text-muted-foreground">{t("Total units", "إجمالي الوحدات")}</span>
          <span className="text-lg font-semibold tabular-nums">{data.totalUnits}</span>
        </div>
      </div>
      <DataTable columns={buildValuationColumns(t)} data={data.items} pagination={false} />
    </div>
  );
}

function CustomerLedgerView({ data, receivable, inventoryValue, customerCount }: { data: CustomerLedgerReport | null; receivable: number; inventoryValue: number; customerCount: number }) {
  const { t } = useT();
  const items = [
    { label: "Accounts receivable", labelAr: "حسابات القبض", value: formatCurrency(receivable) },
    { label: "Inventory value", labelAr: "قيمة المخزون", value: formatCurrency(inventoryValue) },
    { label: "Total customers", labelAr: "إجمالي العملاء", value: String(customerCount) },
    { label: "Avg customer balance", labelAr: "متوسط رصيد العميل", value: formatCurrency(customerCount ? receivable / customerCount : 0) },
  ];

  if (!data || data.customers.length === 0) {
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("Customer ledger", "دفتر العملاء")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.customers.map((customer) => (
              <div key={customer.customerId} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("${count} invoices", "${count} فاتورة").replace("${count}", String(customer.invoices.length))}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-semibold tabular-nums text-destructive">{formatCurrency(customer.open)}</p>
                    <p className="text-xs text-muted-foreground">{t("open balance", "الرصيد المفتوح")}</p>
                  </div>
                </div>
                <DataTable columns={buildLedgerInvoiceColumns(t)} data={customer.invoices} pagination={false} />
              </div>
            ))}
          </CardContent>
        </Card>
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

function buildTrialColumns(t: TranslateFn): ColumnDef<TrialBalanceReport["rows"][number], any>[] {
  return [
    { accessorKey: "code", header: t("Code", "الرمز"), cell: (info) => <span className="font-mono text-xs">{String(info.getValue())}</span> },
    { accessorKey: "name", header: t("Account", "الحساب"), cell: (info) => <span className="font-medium">{String(info.getValue())}</span> },
    {
      accessorKey: "debit",
      header: t("Debit", "مدين"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "credit",
      header: t("Credit", "دائن"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(Number(info.getValue()))}</span>,
    },
  ];
}

function buildAgingColumns(t: TranslateFn, bucketLabels: Record<string, string>): ColumnDef<AgingReport["rows"][number], any>[] {
  return [
    { accessorKey: "number", header: t("Number", "الرقم"), cell: (info) => <span className="font-mono text-xs">{String(info.getValue())}</span> },
    { accessorKey: "partyName", header: t("Party", "الطرف"), cell: (info) => <span className="font-medium">{String(info.getValue())}</span> },
    {
      accessorKey: "dueDate",
      header: t("Due date", "تاريخ الاستحقاق"),
      cell: (info) => <span className="tabular-nums text-sm">{String(info.getValue() ?? "—")}</span>,
    },
    {
      accessorKey: "balance",
      header: t("Balance", "الرصيد"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "bucket",
      header: t("Bucket", "الشريحة"),
      cell: (info) => {
        const key = String(info.getValue());
        return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t(bucketLabels[key] ?? key, bucketLabels[key] ?? key)}</span>;
      },
    },
  ];
}

function buildValuationColumns(t: TranslateFn): ColumnDef<InventoryValuationRow, any>[] {
  return [
    { accessorKey: "sku", header: t("SKU", "كود"), cell: (info) => <span className="font-mono text-xs">{String(info.getValue() ?? "—")}</span> },
    { accessorKey: "name", header: t("Product", "المنتج"), cell: (info) => <span className="font-medium">{String(info.getValue() ?? "—")}</span> },
    { accessorKey: "quantityOnHand", header: t("On hand", "المتاح") },
    {
      accessorKey: "averageCost",
      header: t("Avg cost", "متوسط التكلفة"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "value",
      header: t("Value", "القيمة"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    },
  ];
}

function buildLedgerInvoiceColumns(t: TranslateFn): ColumnDef<CustomerLedgerReport["customers"][number]["invoices"][number], any>[] {
  return [
    { accessorKey: "number", header: t("Number", "الرقم"), cell: (info) => <span className="font-mono text-xs">{String(info.getValue())}</span> },
    {
      accessorKey: "invoiceDate",
      header: t("Date", "التاريخ"),
      cell: (info) => <span className="tabular-nums text-sm">{String(info.getValue()).slice(0, 10)}</span>,
    },
    {
      accessorKey: "total",
      header: t("Total", "الإجمالي"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "balance",
      header: t("Open", "المفتوح"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "status",
      header: t("Status", "الحالة"),
      cell: (info) => <span className="capitalize">{String(info.getValue())}</span>,
    },
  ];
}

const STATEMENT_KIND_LABEL: Record<string, { en: string; ar: string }> = {
  invoice: { en: "Invoice", ar: "فاتورة" },
  payment: { en: "Payment", ar: "دفعة" },
  "credit-note": { en: "Credit note", ar: "إشعار دائن" },
  "debit-note": { en: "Debit note", ar: "إشعار مدين" },
};

interface StatementViewProps {
  parties: Array<{ id: string; name: string; type: string }>;
  partyId: string;
  onPartyChange: (id: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onRun: () => void;
  loading: boolean;
  data: PartyStatement | null;
  onExport: () => void;
  onPrint: () => void;
}

function StatementView({
  parties,
  partyId,
  onPartyChange,
  from,
  to,
  onFromChange,
  onToChange,
  onRun,
  loading,
  data,
  onExport,
  onPrint,
}: StatementViewProps) {
  const { t } = useT();
  const options = useMemo(
    () =>
      parties.map((p) => ({
        value: p.id,
        label: p.name,
        meta: t(p.type === "customer" ? "Customer" : "Supplier", p.type === "customer" ? "عميل" : "مورد"),
      })),
    [parties, t],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label className="mb-1 block text-sm font-medium">{t("Party", "الطرف")}</label>
          <Combobox
            options={options}
            value={partyId}
            onValueChange={onPartyChange}
            placeholder={t("Select customer or supplier…", "اختر عميلاً أو مورّداً…")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("From", "من")}</label>
          <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("To", "إلى")}</label>
          <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-40" />
        </div>
        <Button onClick={onRun} disabled={!partyId || loading}>
          <RefreshCw className="size-4" />
          {t("Run", "تشغيل")}
        </Button>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" onClick={onExport} disabled={!data}>
            <FileSpreadsheet className="size-4" /> {t("Export", "تصدير")}
          </Button>
          <Button variant="outline" onClick={onPrint} disabled={!data}>
            <Printer className="size-4" /> {t("Print", "طباعة")}
          </Button>
        </div>
      </div>

      {!partyId ? (
        <EmptyState
          title={t("Select a party", "اختر طرفاً")}
          description={t("Choose a customer or supplier to see their statement.", "اختر عميلاً أو مورّداً لعرض كشف الحساب الخاص به.")}
        />
      ) : loading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : !data ? (
        <EmptyState
          title={t("Statement unavailable", "كشف الحساب غير متوفر")}
          description={t("The backend could not generate the statement for this period.", "لم يتمكن الخادم من إنشاء كشف الحساب لهذه الفترة.")}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <span className="text-sm text-muted-foreground">{t("Opening balance", "رصيد افتتاحي")}</span>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.openingBalance)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <span className="text-sm text-muted-foreground">{t("Closing balance", "رصيد ختامي")}</span>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.closingBalance)}</span>
            </div>
          </div>
          <DataTable columns={buildStatementColumns(t)} data={data.rows} pagination={false} />
        </div>
      )}
    </div>
  );
}

function buildStatementColumns(t: TranslateFn): ColumnDef<PartyStatement["rows"][number], any>[] {
  return [
    {
      accessorKey: "date",
      header: t("Date", "التاريخ"),
      cell: (info) => <span className="tabular-nums text-sm">{String(info.getValue()).slice(0, 10)}</span>,
    },
    {
      accessorKey: "kind",
      header: t("Type", "النوع"),
      cell: (info) => {
        const meta = STATEMENT_KIND_LABEL[String(info.getValue())];
        return <span className="text-sm">{t(meta?.en ?? String(info.getValue()), meta?.ar ?? String(info.getValue()))}</span>;
      },
    },
    {
      accessorKey: "ref",
      header: t("Reference", "المرجع"),
      cell: (info) => <span className="font-mono text-xs">{String(info.getValue() ?? "—")}</span>,
    },
    {
      accessorKey: "description",
      header: t("Description", "البيان"),
      cell: (info) => <span className="text-sm text-muted-foreground">{String(info.getValue() ?? "—")}</span>,
    },
    {
      accessorKey: "debit",
      header: t("Debit", "مدين"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "credit",
      header: t("Credit", "دائن"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(Number(info.getValue()))}</span>,
    },
    {
      accessorKey: "runningBalance",
      header: t("Balance", "الرصيد"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    },
  ];
}
