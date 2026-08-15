import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Boxes, ClipboardCheck, TriangleAlert, Timer, PackagePlus } from "lucide-react";
import type { StockItem } from "@/types/domain";
import { useInventoryStore } from "@/stores/inventory-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore } from "@/stores/inventory-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { formatDate } from "@/lib/format";
import { inventoryApi } from "@/lib/api";
import type { BatchRow } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { Combobox } from "@/shared/components/forms/combobox";
import { StatCard } from "@/shared/components/layout/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { StockAdjustDialog } from "./stock-adjust-dialog";
import { BatchFormDialog } from "./batch-form-dialog";

interface Row extends StockItem {
  productName: string;
  productSku: string;
  category: string;
  reorderLevel: number;
  available: number;
}

const columnHelper = createColumnHelper<Row>();
const batchColumnHelper = createColumnHelper<BatchRow>();

export function InventoryPage() {
  const stock = useInventoryStore((s) => s.items);
  const updateStock = useInventoryStore((s) => s.update);
  const products = useProductsStore((s) => s.items);
  const warehouses = useWarehousesStore((s) => s.items);
  const canAdjust = usePermission("inventory.adjust");
  const { t } = useT();

  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [adjustItem, setAdjustItem] = useState<Row | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [tab, setTab] = useState("stock");
  const loading = useSimulatedLoading(650, [search, productFilter, warehouseFilter]);

  const loadBatches = async () => {
    setBatchesLoading(true);
    try {
      setBatches(await inventoryApi().batches());
    } catch {
      // Batches are best-effort; the stock table still works without them.
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleBatchSaved = async () => {
    await loadBatches();
    toast.success(t("Batch recorded", "تم تسجيل الدفعة"));
  };

  const rows = useMemo<Row[]>(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    return stock.map((s) => {
      const product = productMap.get(s.productId);
      return {
        ...s,
        productName: product?.name ?? s.productId,
        productSku: product?.sku ?? "—",
        category: product?.category ?? "—",
        reorderLevel: product?.reorderLevel ?? 0,
        available: s.quantity - s.committed,
      };
    });
  }, [stock, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (productFilter && r.productId !== productFilter) return false;
      if (warehouseFilter && r.warehouseId !== warehouseFilter) return false;
      if (q && ![r.productName, r.productSku, r.category, r.batchNumber ?? ""].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, productFilter, warehouseFilter]);

  const totals = useMemo(() => {
    const totalUnits = rows.reduce((sum, r) => sum + r.available, 0);
    const lowCount = rows.filter((r) => r.available <= r.reorderLevel).length;
    const distinctProducts = new Set(rows.map((r) => r.productId)).size;
    const expiringCount = rows.filter(
      (r) => r.expiryDate && new Date(r.expiryDate).getTime() - Date.now() < 30 * 86400000,
    ).length;
    return { totalUnits, lowCount, distinctProducts, expiringCount };
  }, [rows]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name, meta: p.sku })),
    [products],
  );
  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name, meta: w.code })),
    [warehouses],
  );

  const handleAdjust = async (req: { delta: number; reason: string }) => {
    if (!adjustItem) return;
    try {
      const res = await inventoryApi().adjust({
        productId: adjustItem.productId,
        warehouseId: adjustItem.warehouseId,
        quantity: req.delta,
        reason: req.reason || "manual adjustment",
      });
      const row = stock.find((s) => s.id === adjustItem.id);
      if (row) {
        updateStock(adjustItem.id, {
          quantity: res.newQuantity,
          committed: row.committed,
        });
      }
      toast.success(t("Stock adjusted to ${newQuantity} units", "تم تعديل المخزون إلى ${newQuantity} وحدة").replace("${newQuantity}", String(res.newQuantity)));
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
    setAdjustOpen(false);
    setAdjustItem(null);
  };

  const columns = useMemo<ColumnDef<Row, any>[]>(() => {
    const statusVariant = (available: number, reorder: number) =>
      available <= 0 ? "destructive" : available <= reorder ? "warning" : "success";

    return [
      columnHelper.accessor("productName", {
        header: t("Product", "المنتج"),
        cell: (info) => (
          <div>
            <p className="font-medium">{info.getValue()}</p>
            <p className="text-xs text-muted-foreground">{info.row.original.productSku}</p>
          </div>
        ),
      }),
      columnHelper.accessor("category", { header: t("Category", "الفئة"), cell: (info) => info.getValue() || "—" }),
      columnHelper.accessor("quantity", {
        header: t("On hand", "المتوفر"),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor("committed", {
        header: t("Committed", "المحجوز"),
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor("available", {
        header: t("Available", "المتاح"),
        cell: (info) => {
          const r = info.row.original;
          return (
            <Badge variant={statusVariant(info.getValue(), r.reorderLevel)} dot>
              {info.getValue()} {t("units", "وحدة")}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "status",
        header: t("Status", "الحالة"),
        cell: (info) => {
          const r = info.row.original;
          if (r.available <= 0) return <Badge variant="destructive">{t("Out of stock", "نفذ المخزون")}</Badge>;
          if (r.available <= r.reorderLevel) return <Badge variant="warning">{t("Low", "منخفض")}</Badge>;
          return <Badge variant="success">{t("In stock", "متوفر")}</Badge>;
        },
      }),
    ];
  }, [t]);

  const batchColumns = useMemo<ColumnDef<BatchRow, any>[]>(() => [
    batchColumnHelper.accessor("productName", {
      header: t("Product", "المنتج"),
      cell: (info) => (
        <div>
          <p className="font-medium">{info.getValue() ?? info.row.original.productId}</p>
          <p className="text-xs text-muted-foreground">{info.row.original.sku ?? "—"}</p>
        </div>
      ),
    }),
    batchColumnHelper.accessor("batchNumber", { header: t("Batch / Lot", "الدفعة / اللوت"), cell: (info) => <span className="font-mono">{info.getValue()}</span> }),
    batchColumnHelper.accessor("warehouseName", { header: t("Warehouse", "المستودع"), cell: (info) => info.getValue() ?? "—" }),
    batchColumnHelper.accessor("quantity", {
      header: t("Qty", "الكمية"),
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    batchColumnHelper.accessor("expiryDate", {
      header: t("Expiry", "انتهاء الصلاحية"),
      cell: (info) => {
        const v = info.getValue();
        if (!v) return <span className="text-muted-foreground">—</span>;
        const soon = new Date(v).getTime() - Date.now() < 30 * 86400000;
        return <span className={soon ? "text-destructive" : ""}>{formatDate(v, "MMM d, yyyy")}</span>;
      },
    }),
    batchColumnHelper.accessor("receivedAt", {
      header: t("Received", "التاريخ"),
      cell: (info) => <span className="text-muted-foreground">{formatDate(info.getValue(), "MMM d, yyyy")}</span>,
    }),
  ], [t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Inventory", "المخزون")}
        description={t("Track stock levels across products and warehouses. Click a row to adjust stock.", "تتبع مستويات المخزون عبر المنتجات والمستودعات. انقر على أي صف لتعديل المخزون.")}
      >
        {canAdjust ? (
          <Button onClick={() => { setBatchOpen(true); loadBatches(); }}>
            <PackagePlus className="size-4" />
            {t("Record batch", "تسجيل دفعة")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label={t("Available units", "الوحدات المتوفرة")} value={String(totals.totalUnits)} icon={Boxes} iconClassName="bg-primary/10 text-primary" />
        <StatCard index={1} label={t("Products tracked", "المنتجات المتتبعة")} value={String(totals.distinctProducts)} icon={ClipboardCheck} iconClassName="bg-info/10 text-info" />
        <StatCard index={2} label={t("Low stock", "مخزون منخفض")} value={String(totals.lowCount)} icon={TriangleAlert} iconClassName="bg-warning/15 text-warning" footer={t("needs attention", "يحتاج إلى انتباه")} />
        <StatCard index={3} label={t("Expiring soon", "ينتهي قريباً")} value={String(totals.expiringCount)} icon={Timer} iconClassName="bg-destructive/10 text-destructive" footer={t("within 30 days", "خلال 30 يوماً")} />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "batches" && batches.length === 0) loadBatches(); }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="stock">{t("Stock", "المخزون")}</TabsTrigger>
            <TabsTrigger value="batches">{t("Batches", "الدفعات")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stock" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            {loading ? (
              <div className="p-4"><SkeletonTable rows={8} columns={5} /></div>
            ) : (
              <DataTable
                columns={columns}
                data={filtered}
                onRowClick={(row) => {
                  if (canAdjust) {
                    setAdjustItem(row);
                    setAdjustOpen(true);
                  }
                }}
                toolbar={
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <SearchInput
                      placeholder={t("Search inventory…", "ابحث في المخزون…")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClear={() => setSearch("")}
                      className="w-full sm:w-60"
                    />
                    <Combobox options={productOptions} value={productFilter} onValueChange={setProductFilter} placeholder={t("All products", "كل المنتجات")} className="w-44" />
                    <Combobox options={warehouseOptions} value={warehouseFilter} onValueChange={setWarehouseFilter} placeholder={t("All warehouses", "كل المستودعات")} className="w-44" />
                    <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("records", "سجلاً")}</div>
                  </div>
                }
                emptyTitle={t("No stock found", "لا يوجد مخزون")}
                emptyDescription={t("Adjust your filters or add stock to get started.", "عدّل عوامل التصفية أو أضف مخزوناً للبدء.")}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="batches" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            {batchesLoading ? (
              <div className="p-4"><SkeletonTable rows={8} columns={5} /></div>
            ) : (
              <DataTable
                columns={batchColumns}
                data={batches}
                emptyTitle={t("No batches recorded yet", "لا توجد دفعات مسجلة بعد")}
                emptyDescription={t("Record a batch to track lots and expiry dates.", "سجّل دفعة لتتبع اللوتات وتواريخ انتهاء الصلاحية.")}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <StockAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        item={adjustItem}
        onConfirm={handleAdjust}
      />

      <BatchFormDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        products={products}
        warehouses={warehouses}
        onSaved={handleBatchSaved}
      />
    </div>
  );
}