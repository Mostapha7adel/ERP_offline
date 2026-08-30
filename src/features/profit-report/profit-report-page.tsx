import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  TrendingUp, Download,
} from "lucide-react";
import { useProfitReportStore } from "@/stores/profit-report-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { profitReportApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { ProfitReportItem } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const columnHelper = createColumnHelper<ProfitReportItem>();

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

function buildColumns(h: {
  t: TranslateFn;
}): ColumnDef<ProfitReportItem, any>[] {
  return [
    columnHelper.accessor("productName", {
      header: h.t("Product", "المنتج"),
      cell: (info) => {
        const item = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue()}</p>
              {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("quantitySold", {
      header: h.t("Qty Sold", "الكمية المباعة"),
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor("revenue", {
      header: h.t("Revenue", "الإيرادات"),
      cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
    }),
    columnHelper.accessor("cost", {
      header: h.t("Cost", "التكلفة"),
      cell: (info) => <span className="tabular-nums text-muted-foreground">{money(info.getValue())}</span>,
    }),
    columnHelper.accessor("profit", {
      header: h.t("Profit", "الربح"),
      cell: (info) => {
        const value = info.getValue();
        return (
          <span className={`tabular-nums font-medium ${value >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {money(value)}
          </span>
        );
      },
    }),
    columnHelper.accessor("margin", {
      header: h.t("Margin", "هامش الربح"),
      cell: (info) => {
        const value = info.getValue();
        return (
          <span className={`tabular-nums font-medium ${value >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {percent(value)}
          </span>
        );
      },
    }),
  ];
}

export function ProfitReportPage() {
  const items = useProfitReportStore((s) => s.items);
  const hydrate = useProfitReportStore((s) => s.hydrate);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const canView = usePermission("reports.view");
  const simLoading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await profitReportApi().getReport({
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      hydrate(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load report", "فشل تحميل التقرير"));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const revenue = items.reduce((sum, i) => sum + i.revenue, 0);
    const cost = items.reduce((sum, i) => sum + i.cost, 0);
    const profit = items.reduce((sum, i) => sum + i.profit, 0);
    const margin = revenue > 0 ? profit / revenue : 0;
    return { revenue, cost, profit, margin };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.productName, i.sku ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const exportCsv = () => {
    const headers = ["Product", "SKU", "Qty Sold", "Revenue", "Cost", "Profit", "Margin"];
    const rows = items.map((i) => [i.productName, i.sku ?? "", i.quantitySold, i.revenue, i.cost, i.profit, i.margin].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "profit-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<ColumnDef<ProfitReportItem, any>[]>(
    () => buildColumns({ t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Profit by Product", "أرباح المنتجات")}
        description={t("Analyze revenue, cost, and profit per product.", "تحليل الإيرادات والتكلفة والربح لكل منتج.")}
      >
        {canView ? (
          <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
            <Download className="size-4" />
            {t("Export CSV", "تصدير CSV")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label>{t("From", "من")}</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("To", "إلى")}</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
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
              <p className="text-muted-foreground">{t("Cost", "التكلفة")}</p>
              <p className="font-medium tabular-nums">{money(totals.cost)}</p>
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
          <div className="p-4"><SkeletonTable rows={6} columns={6} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search products…", "ابحث عن منتجات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("products", "منتج")}</div>
              </div>
            }
            emptyTitle={t("No data", "لا توجد بيانات")}
            emptyDescription={t("Set a date range and click Load Report to view profit data.", "حدد نطاق التاريخ واضغط تحميل التقرير لعرض بيانات الأرباح.")}
          />
        )}
      </div>
    </div>
  );
}
