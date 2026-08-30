import { useMemo, useState } from "react";
import { GitCompareArrows, TrendingUp, TrendingDown } from "lucide-react";
import { usePeriodComparisonStore } from "@/stores/period-comparison-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { periodComparisonApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function ChangeIndicator({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
      {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

export function PeriodComparisonPage() {
  const { t } = useT();
  const simLoading = useSimulatedLoading(600);
  const report = usePeriodComparisonStore((s) => s.report);
  const hydrate = usePeriodComparisonStore((s) => s.hydrate);

  const [p1From, setP1From] = useState("");
  const [p1To, setP1To] = useState("");
  const [p2From, setP2From] = useState("");
  const [p2To, setP2To] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    if (!p1From || !p1To || !p2From || !p2To) {
      toast.error(t("Please fill all date fields", "يرجى ملء جميع حقول التاريخ"));
      return;
    }
    setLoading(true);
    try {
      const data = await periodComparisonApi().compare(p1From, p1To, p2From, p2To);
      hydrate(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load report", "فشل تحميل التقرير"));
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    if (!report) return [];
    return [
      {
        label: t("Revenue", "الإيرادات"),
        labelAr: "الإيرادات",
        p1: report.period1.revenue,
        p2: report.period2.revenue,
        change: report.changes.revenueChange,
      },
      {
        label: t("Expenses", "المصروفات"),
        labelAr: "المصروفات",
        p1: report.period1.expenses,
        p2: report.period2.expenses,
        change: report.changes.expensesChange,
      },
      {
        label: t("Profit", "الربح"),
        labelAr: "الربح",
        p1: report.period1.profit,
        p2: report.period2.profit,
        change: report.changes.profitChange,
      },
    ];
  }, [report, t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Period Comparison", "مقارنة الفترات")}
        description={t("Compare financial data between two periods.", "مقارنة البيانات المالية بين فترتين.")}
      />

      <div className="grid gap-4 sm:grid-cols-2 rounded-xl border bg-card p-4">
        <div className="space-y-3">
          <p className="text-sm font-semibold">{t("Period 1", "الفترة الأولى")}</p>
          <div className="flex gap-2">
            <div className="space-y-1.5">
              <Label>{t("From", "من")}</Label>
              <Input type="date" value={p1From} onChange={(e) => setP1From(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("To", "إلى")}</Label>
              <Input type="date" value={p1To} onChange={(e) => setP1To(e.target.value)} className="w-40" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold">{t("Period 2", "الفترة الثانية")}</p>
          <div className="flex gap-2">
            <div className="space-y-1.5">
              <Label>{t("From", "من")}</Label>
              <Input type="date" value={p2From} onChange={(e) => setP2From(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("To", "إلى")}</Label>
              <Input type="date" value={p2To} onChange={(e) => setP2To(e.target.value)} className="w-40" />
            </div>
          </div>
        </div>
      </div>

      <Button onClick={loadReport} loading={loading}>
        {t("Compare", "قارن")}
      </Button>

      {report && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-medium">{t("Metric", "المقياس")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("Period 1", "الفترة الأولى")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("Period 2", "الفترة الثانية")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("Change", "التغيير")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{money(row.p1)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{money(row.p2)}</td>
                    <td className="px-4 py-3 text-end">
                      <ChangeIndicator value={row.change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Period 1", "الفترة الأولى")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{report.period1.from} — {report.period1.to}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{money(report.period1.profit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Period 2", "الفترة الثانية")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{report.period2.from} — {report.period2.to}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{money(report.period2.profit)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!report && !loading && !simLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <GitCompareArrows className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            {t("Select two date ranges and click Compare to view the comparison.", "اختر نطاقَي تاريخ واضغط قارن لعرض المقارنة.")}
          </p>
        </div>
      )}
    </div>
  );
}
