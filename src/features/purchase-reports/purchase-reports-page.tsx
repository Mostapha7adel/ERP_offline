import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { ShoppingCart } from "lucide-react";
import { usePurchaseReportsStore } from "@/stores/purchase-reports-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { purchaseReportApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { PurchaseBySupplier, PurchaseByCategory, PurchaseTrend } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";

const supplierHelper = createColumnHelper<PurchaseBySupplier>();
const categoryHelper = createColumnHelper<PurchaseByCategory>();
const trendHelper = createColumnHelper<PurchaseTrend>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function PurchaseReportsPage() {
  const { t } = useT();
  const simLoading = useSimulatedLoading(600);

  const bySupplier = usePurchaseReportsStore((s) => s.bySupplier);
  const byCategory = usePurchaseReportsStore((s) => s.byCategory);
  const trend = usePurchaseReportsStore((s) => s.trend);
  const hydrateBySupplier = usePurchaseReportsStore((s) => s.hydrateBySupplier);
  const hydrateByCategory = usePurchaseReportsStore((s) => s.hydrateByCategory);
  const hydrateTrend = usePurchaseReportsStore((s) => s.hydrateTrend);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const [suppliers, categories, trends] = await Promise.all([
        purchaseReportApi().bySupplier(dateFrom || undefined, dateTo || undefined),
        purchaseReportApi().byCategory(dateFrom || undefined, dateTo || undefined),
        purchaseReportApi().trend(dateFrom || undefined, dateTo || undefined),
      ]);
      hydrateBySupplier(suppliers);
      hydrateByCategory(categories);
      hydrateTrend(trends);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load report", "فشل تحميل التقرير"));
    } finally {
      setLoading(false);
    }
  };

  const supplierColumns = useMemo<ColumnDef<PurchaseBySupplier, any>[]>(
    () => [
      supplierHelper.accessor("supplierName", {
        header: t("Supplier", "المورد"),
      }),
      supplierHelper.accessor("invoiceCount", {
        header: t("Invoices", "الفواتير"),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      supplierHelper.accessor("totalAmount", {
        header: t("Total Amount", "إجمالي المبلغ"),
        cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
      }),
      supplierHelper.accessor("averageInvoice", {
        header: t("Average", "المتوسط"),
        cell: (info) => <span className="tabular-nums text-muted-foreground">{money(info.getValue())}</span>,
      }),
    ],
    [t],
  );

  const categoryColumns = useMemo<ColumnDef<PurchaseByCategory, any>[]>(
    () => [
      categoryHelper.accessor("category", {
        header: t("Category", "الفئة"),
      }),
      categoryHelper.accessor("totalAmount", {
        header: t("Total Amount", "إجمالي المبلغ"),
        cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
      }),
      categoryHelper.accessor("itemPercentage", {
        header: t("Percentage", "النسبة"),
        cell: (info) => <span className="tabular-nums">{info.getValue().toFixed(1)}%</span>,
      }),
    ],
    [t],
  );

  const trendColumns = useMemo<ColumnDef<PurchaseTrend, any>[]>(
    () => [
      trendHelper.accessor("period", {
        header: t("Period", "الفترة"),
      }),
      trendHelper.accessor("invoiceCount", {
        header: t("Invoices", "الفواتير"),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      trendHelper.accessor("totalAmount", {
        header: t("Total Amount", "إجمالي المبلغ"),
        cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
      }),
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Purchase Reports", "تقارير المشتريات")}
        description={t("Analyze purchases by supplier, category, and trend.", "تحليل المشتريات حسب المورد والفئة والاتجاه.")}
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

      {(bySupplier.length > 0 || byCategory.length > 0 || trend.length > 0) ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          {loading ? (
            <div className="p-4"><SkeletonTable rows={6} columns={4} /></div>
          ) : (
            <Tabs defaultValue="supplier" className="p-4">
              <TabsList>
                <TabsTrigger value="supplier">{t("By Supplier", "حسب المورد")}</TabsTrigger>
                <TabsTrigger value="category">{t("By Category", "حسب الفئة")}</TabsTrigger>
                <TabsTrigger value="trend">{t("Trend", "الاتجاه")}</TabsTrigger>
              </TabsList>
              <TabsContent value="supplier">
                <DataTable
                  columns={supplierColumns}
                  data={bySupplier}
                  emptyTitle={t("No data", "لا توجد بيانات")}
                  emptyDescription={t("No supplier data available.", "لا تتوفر بيانات الموردين.")}
                />
              </TabsContent>
              <TabsContent value="category">
                <DataTable
                  columns={categoryColumns}
                  data={byCategory}
                  emptyTitle={t("No data", "لا توجد بيانات")}
                  emptyDescription={t("No category data available.", "لا تتوفر بيانات الفئات.")}
                />
              </TabsContent>
              <TabsContent value="trend">
                <DataTable
                  columns={trendColumns}
                  data={trend}
                  emptyTitle={t("No data", "لا توجد بيانات")}
                  emptyDescription={t("No trend data available.", "لا تتوفر بيانات الاتجاه.")}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      ) : (
        !loading && !simLoading && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
            <ShoppingCart className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              {t("Set a date range and click Load Report to view purchase data.", "حدد نطاق التاريخ واضغط تحميل التقرير لعرض بيانات المشتريات.")}
            </p>
          </div>
        )
      )}
    </div>
  );
}
