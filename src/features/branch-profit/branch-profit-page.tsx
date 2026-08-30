import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { useBranchProfitStore } from "@/stores/branch-profit-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { branchProfitApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { BranchProfitItem } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";

const columnHelper = createColumnHelper<BranchProfitItem>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function BranchProfitPage() {
  const { t } = useT();
  const simLoading = useSimulatedLoading(600);
  const items = useBranchProfitStore((s) => s.items);
  const hydrate = useBranchProfitStore((s) => s.hydrate);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await branchProfitApi().getReport(dateFrom || undefined, dateTo || undefined);
      hydrate(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load report", "فشل تحميل التقرير"));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const revenue = items.reduce((sum, i) => sum + i.revenue, 0);
    const expenses = items.reduce((sum, i) => sum + i.expenses, 0);
    const profit = items.reduce((sum, i) => sum + i.profit, 0);
    const margin = revenue > 0 ? profit / revenue : 0;
    return { revenue, expenses, profit, margin };
  }, [items]);

  const columns = useMemo<ColumnDef<BranchProfitItem, any>[]>(
    () => [
      columnHelper.accessor("branchName", {
        header: t("Branch", "الفرع"),
        cell: (info) => {
          return (
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <span className="font-medium">{info.getValue()}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("revenue", {
        header: t("Revenue", "الإيرادات"),
        cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
      }),
      columnHelper.accessor("expenses", {
        header: t("Expenses", "المصروفات"),
        cell: (info) => <span className="tabular-nums text-muted-foreground">{money(info.getValue())}</span>,
      }),
      columnHelper.accessor("profit", {
        header: t("Profit", "الربح"),
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={`tabular-nums font-medium ${v >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {money(v)}
            </span>
          );
        },
      }),
      columnHelper.accessor("margin", {
        header: t("Margin", "هامش الربح"),
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={`tabular-nums font-medium ${v >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {percent(v)}
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
        title={t("Branch Profit", "أرباح الفروع")}
        description={t("Compare profit across branches.", "مقارنة الأرباح بين الفروع.")}
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

        {items.length > 0 && (
          <div className="ms-auto flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">{t("Revenue", "الإيرادات")}</p>
              <p className="font-medium tabular-nums">{money(totals.revenue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("Expenses", "المصروفات")}</p>
              <p className="font-medium tabular-nums">{money(totals.expenses)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("Profit", "الربح")}</p>
              <p className={`font-medium tabular-nums ${totals.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{money(totals.profit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("Margin", "هامش الربح")}</p>
              <p className={`font-medium tabular-nums ${totals.margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>{percent(totals.margin)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {(simLoading || loading) ? (
          <div className="p-4"><SkeletonTable rows={6} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            emptyTitle={t("No data", "لا توجد بيانات")}
            emptyDescription={t("Set a date range and click Load Report to view branch profit data.", "حدد نطاق التاريخ واضغط تحميل التقرير لعرض أرباح الفروع.")}
          />
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">{t("Revenue by Branch", "الإيرادات حسب الفرع")}</h3>
          <div className="flex items-end gap-2">
            {items.map((item) => {
              const maxRevenue = Math.max(...items.map((i) => i.revenue), 1);
              const height = (item.revenue / maxRevenue) * 100;
              return (
                <div key={item.branchId} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs tabular-nums">{money(item.revenue)}</span>
                  <div
                    className="w-full rounded-t-md bg-primary/80 transition-all"
                    style={{ height: `${Math.max(height, 4)}%`, minHeight: "8px" }}
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-full">{item.branchName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
