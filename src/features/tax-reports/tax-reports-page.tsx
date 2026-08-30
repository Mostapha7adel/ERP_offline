import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { FileText, CalendarDays } from "lucide-react";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { taxReportApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { TaxReport, TaxReportLine } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { DataTable } from "@/shared/components/data-table/data-table";

const lineColumnHelper = createColumnHelper<TaxReportLine>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function SummaryCard({ title, titleAr, value, t }: { title: string; titleAr: string; value: number; t: TranslateFn }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t(title, titleAr)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{money(value)}</p>
      </CardContent>
    </Card>
  );
}

export function TaxReportsPage() {
  const { t } = useT();
  const loading = useSimulatedLoading();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<TaxReport | null>(null);
  const [fetching, setFetching] = useState(false);

  const handleGenerate = async () => {
    setFetching(true);
    try {
      const result = await taxReportApi().generate(
        from || to ? { from: from || undefined, to: to || undefined } : undefined,
      );
      setReport(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to generate report", "فشل إنشاء التقرير"));
    } finally {
      setFetching(false);
    }
  };

  const breakdownColumns = useMemo<ColumnDef<TaxReportLine, any>[]>(
    () => [
      lineColumnHelper.accessor("taxRate", {
        header: t("Tax Rate", "نسبة الضريبة"),
        cell: (info) => `${info.getValue()}%`,
      }),
      lineColumnHelper.accessor("taxableAmount", {
        header: t("Taxable Amount", "المبلغ الخاضع للضريبة"),
        cell: (info) => <span className="tabular-nums">{money(info.getValue())}</span>,
      }),
      lineColumnHelper.accessor("taxAmount", {
        header: t("Tax Amount", "مبلغ الضريبة"),
        cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
      }),
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Tax Reports", "تقارير الضرائب")}
        description={t("Generate tax reports for a given period.", "إنشاء تقارير ضرائب لفترة محددة.")}
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>{t("From", "من")}</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("To", "إلى")}</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={handleGenerate} loading={fetching}>
          <CalendarDays className="size-4 me-1" />
          {t("Generate Report", "إنشاء التقرير")}
        </Button>
      </div>

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard title="Total Sales" titleAr="إجمالي المبيعات" value={report.totalSales} t={t} />
            <SummaryCard title="Total Purchases" titleAr="إجمالي المشتريات" value={report.totalPurchases} t={t} />
            <SummaryCard title="Tax Collected" titleAr="الضريبة المحصلة" value={report.taxCollected} t={t} />
            <SummaryCard title="Tax Paid" titleAr="الضريبة المدفوعة" value={report.taxPaid} t={t} />
            <SummaryCard title="Net Tax" titleAr="صافي الضريبة" value={report.netTax} t={t} />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="p-4">
              <h3 className="text-lg font-semibold">{t("Breakdown by Tax Rate", "تفصيل حسب نسبة الضريبة")}</h3>
            </div>
            <DataTable
              columns={breakdownColumns}
              data={report.breakdown}
              emptyTitle={t("No data", "لا توجد بيانات")}
              emptyDescription={t("No tax breakdown available for this period.", "لا يوجد تفصيل ضرائب لهذه الفترة.")}
            />
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <FileText className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            {t("Select a date range and click Generate to view the tax report.", "اختر نطاق التاريخ واضغط إنشاء لعرض تقرير الضرائب.")}
          </p>
        </div>
      )}
    </div>
  );
}
