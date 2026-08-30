import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useCurrencyGainLossStore } from "@/stores/currency-gain-loss-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { currencyGainLossApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { CurrencyGainLossItem } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

const columnHelper = createColumnHelper<CurrencyGainLossItem>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function CurrencyGainLossPage() {
  const { t } = useT();
  const simLoading = useSimulatedLoading(600);
  const items = useCurrencyGainLossStore((s) => s.items);
  const hydrate = useCurrencyGainLossStore((s) => s.hydrate);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await currencyGainLossApi().getReport(dateFrom || undefined, dateTo || undefined);
      hydrate(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load report", "فشل تحميل التقرير"));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const totalGain = items.filter((i) => i.gainOrLoss > 0).reduce((sum, i) => sum + i.gainOrLoss, 0);
    const totalLoss = items.filter((i) => i.gainOrLoss < 0).reduce((sum, i) => sum + i.gainOrLoss, 0);
    const net = items.reduce((sum, i) => sum + i.gainOrLoss, 0);
    return { totalGain, totalLoss, net };
  }, [items]);

  const columns = useMemo<ColumnDef<CurrencyGainLossItem, any>[]>(
    () => [
      columnHelper.accessor("invoiceNumber", {
        header: t("Invoice #", "رقم الفاتورة"),
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor("currency", {
        header: t("Currency", "العملة"),
      }),
      columnHelper.accessor("invoiceAmount", {
        header: t("Invoice Amount", "مبلغ الفاتورة"),
        cell: (info) => <span className="tabular-nums">{money(info.getValue())}</span>,
      }),
      columnHelper.accessor("rateAtInvoice", {
        header: t("Rate at Invoice", "سعر الصرف عند الفاتورة"),
        cell: (info) => <span className="tabular-nums">{info.getValue().toFixed(4)}</span>,
      }),
      columnHelper.accessor("rateAtPayment", {
        header: t("Rate at Payment", "سعر الصرف عند الدفع"),
        cell: (info) => <span className="tabular-nums">{info.getValue().toFixed(4)}</span>,
      }),
      columnHelper.accessor("gainOrLoss", {
        header: t("Gain/Loss", "الربح/الخسارة"),
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={`tabular-nums font-medium ${v >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {money(v)}
            </span>
          );
        },
      }),
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Currency Gain/Loss", "فروقات العملة")}
        description={t("Track currency exchange rate differences.", "تتبع فروقات أسعار صرف العملات.")}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label>{t("From", "من")}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("To", "إلى")}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={loadReport} loading={loading}>
          {t("Load Report", "تحميل التقرير")}
        </Button>
      </div>

      {items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Total Gain", "إجمالي الأرباح")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">{money(totals.totalGain)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Total Loss", "إجمالي الخسائر")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-destructive">{money(totals.totalLoss)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Net", "الصافي")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold tabular-nums ${totals.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {money(totals.net)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            {loading ? (
              <div className="p-4"><SkeletonTable rows={6} columns={6} /></div>
            ) : (
              <DataTable
                columns={columns}
                data={items}
                emptyTitle={t("No data", "لا توجد بيانات")}
                emptyDescription={t("No currency gain/loss data found.", "لم يتم العثور على بيانات فروقات العملة.")}
              />
            )}
          </div>
        </>
      )}

      {!items.length && !loading && !simLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <ArrowUpDown className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            {t("Set a date range and click Load Report to view currency differences.", "حدد نطاق التاريخ واضغط تحميل التقرير لعرض فروقات العملة.")}
          </p>
        </div>
      )}
    </div>
  );
}
