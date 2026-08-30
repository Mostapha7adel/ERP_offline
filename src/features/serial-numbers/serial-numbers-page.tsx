import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, Hash, Upload,
} from "lucide-react";
import { useSerialNumbersStore } from "@/stores/serial-numbers-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore } from "@/stores/inventory-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { serialNumbersApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { SerialNumber } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const columnHelper = createColumnHelper<SerialNumber>();

const STATUS_LABELS: Record<string, { en: string; ar: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  available: { en: "Available", ar: "متاح", variant: "default" },
  sold: { en: "Sold", ar: "مباع", variant: "secondary" },
  reserved: { en: "Reserved", ar: "محجوز", variant: "outline" },
  returned: { en: "Returned", ar: "مرتجع", variant: "outline" },
  defective: { en: "Defective", ar: "معيب", variant: "destructive" },
};

function buildColumns(h: {
  canManage: boolean;
  t: TranslateFn;
}): ColumnDef<SerialNumber, any>[] {
  return [
    columnHelper.accessor("productName", {
      header: h.t("Product", "المنتج"),
      cell: (info) => {
        const sn = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Hash className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? sn.productId}</p>
              <p className="text-xs text-muted-foreground">{sn.sku}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("serialNumber", {
      header: h.t("Serial Number", "الرقم التسلسلي"),
      cell: (info) => (
        <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono">{info.getValue()}</code>
      ),
    }),
    columnHelper.accessor("warehouseName", {
      header: h.t("Warehouse", "المخزن"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const label = STATUS_LABELS[status] ?? { en: status, ar: status, variant: "outline" as const };
        return <Badge variant={label.variant}>{h.t(label.en, label.ar)}</Badge>;
      },
    }),
    columnHelper.accessor("customerName", {
      header: h.t("Customer", "العميل"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("createdAt", {
      header: h.t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
  ];
}

export function SerialNumbersPage() {
  const items = useSerialNumbersStore((s) => s.items);
  const add = useSerialNumbersStore((s) => s.add);
  const products = useProductsStore((s) => s.items);
  const warehouses = useWarehousesStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canCreate = usePermission("serial-numbers.create");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (statusFilter) list = list.filter((sn) => sn.status === statusFilter);
    if (!q) return list;
    return list.filter((sn) =>
      [sn.serialNumber, sn.productName ?? "", sn.sku ?? "", sn.warehouseName ?? "", sn.customerName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search, statusFilter]);

  const handleCreate = async (data: { productId: string; serialNumber: string; warehouseId: string }) => {
    setBusy(true);
    try {
      const created = await serialNumbersApi().create(data);
      add(created);
      toast.success(t("Serial number created", "تم إنشاء الرقم التسلسلي"));
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const handleBulkCreate = async (data: { productId: string; warehouseId: string; serialNumbers: string[] }) => {
    setBusy(true);
    try {
      const created = await serialNumbersApi().bulkCreate(data);
      created.forEach((sn) => add(sn));
      toast.success(t("Serial numbers created", "تم إنشاء الأرقام التسلسلية"));
      setBulkOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<SerialNumber, any>[]>(
    () => buildColumns({ canManage: true, t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Serial Numbers", "الأرقام التسلسلية")}
        description={t("Track serial numbers for products.", "تتبع الأرقام التسلسلية للمنتجات.")}
      >
        {canCreate ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="size-4" />
              {t("Bulk import", "استيراد جماعي")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("Add serial", "إضافة رقم تسلسلي")}
            </Button>
          </div>
        ) : null}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={6} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search serial numbers…", "ابحث عن أرقام تسلسلية…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">{t("All statuses", "جميع الحالات")}</option>
                  {Object.entries(STATUS_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.ar}</option>
                  ))}
                </select>
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("serials", "رقم تسلسلي")}</div>
              </div>
            }
            emptyTitle={t("No serial numbers", "لا توجد أرقام تسلسلية")}
            emptyDescription={t("Add serial numbers to track individual product units.", "أضف أرقام تسلسلية لتتبع وحدات المنتج الفردية.")}
          />
        )}
      </div>

      <SerialNumberFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        onSave={handleCreate}
        busy={busy}
      />

      <BulkSerialDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        onSave={handleBulkCreate}
        busy={busy}
      />
    </div>
  );
}

function SerialNumberFormDialog({
  open,
  onOpenChange,
  products,
  warehouses,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; name: string; sku?: string }>;
  warehouses: Array<{ id: string; name: string }>;
  onSave: (data: { productId: string; serialNumber: string; warehouseId: string }) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [productId, setProductId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const handleSave = () => {
    onSave({ productId, serialNumber, warehouseId });
    setProductId("");
    setSerialNumber("");
    setWarehouseId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add Serial Number", "إضافة رقم تسلسلي")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Product", "المنتج")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{t("Select product…", "اختر منتجاً…")}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Serial Number", "الرقم التسلسلي")}</Label>
            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder={t("Enter serial number", "أدخل الرقم التسلسلي")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Warehouse", "المخزن")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t("Select warehouse…", "اختر مخزناً…")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} loading={busy} disabled={!productId || !serialNumber}>
            {t("Add", "إضافة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkSerialDialog({
  open,
  onOpenChange,
  products,
  warehouses,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; name: string; sku?: string }>;
  warehouses: Array<{ id: string; name: string }>;
  onSave: (data: { productId: string; warehouseId: string; serialNumbers: string[] }) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [text, setText] = useState("");

  const handleSave = () => {
    const serials = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (serials.length === 0) return;
    onSave({ productId, warehouseId, serialNumbers: serials });
    setProductId("");
    setWarehouseId("");
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Bulk Import Serial Numbers", "استيراد أرقام تسلسلية جماعي")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Product", "المنتج")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{t("Select product…", "اختر منتجاً…")}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Warehouse", "المخزن")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t("Select warehouse…", "اختر مخزناً…")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Serial Numbers (one per line)", "الأرقام التسلسلية (واحد لكل سطر)")}</Label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("SN001\nSN002\nSN003", "الرقم001\nالرقم002\nالرقم003")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} loading={busy} disabled={!productId || !text.trim()}>
            {t("Import", "استيراد")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
