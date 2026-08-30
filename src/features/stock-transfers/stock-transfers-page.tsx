import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, Pencil, ArrowLeftRight, CheckCircle, XCircle,
} from "lucide-react";
import { useStockTransfersStore } from "@/stores/stock-transfers-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore } from "@/stores/inventory-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { stockTransfersApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { StockTransfer, StockTransferLine } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const columnHelper = createColumnHelper<StockTransfer>();

const STATUS_LABELS: Record<string, { en: string; ar: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { en: "Draft", ar: "مسودة", variant: "secondary" },
  pending: { en: "Pending", ar: "قيد الانتظار", variant: "outline" },
  in_transit: { en: "In Transit", ar: "في الطريق", variant: "default" },
  completed: { en: "Completed", ar: "مكتمل", variant: "default" },
  cancelled: { en: "Cancelled", ar: "ملغي", variant: "destructive" },
};

function buildColumns(h: {
  onEdit: (t: StockTransfer) => void;
  onRemove: (t: StockTransfer) => void;
  onComplete: (t: StockTransfer) => void;
  onCancel: (t: StockTransfer) => void;
  canManage: boolean;
  canComplete: boolean;
  t: TranslateFn;
}): ColumnDef<StockTransfer, any>[] {
  return [
    columnHelper.accessor("number", {
      header: h.t("Transfer Number", "رقم التحويل"),
      cell: (info) => {
        const t = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowLeftRight className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue()}</p>
              <p className="text-xs text-muted-foreground">{formatDate(t.transferDate)}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("fromWarehouseName", {
      header: h.t("From Warehouse", "من المخزن"),
      cell: (info) => info.getValue() ?? info.row.original.fromWarehouseId,
    }),
    columnHelper.accessor("toWarehouseName", {
      header: h.t("To Warehouse", "إلى المخزن"),
      cell: (info) => info.getValue() ?? info.row.original.toWarehouseId,
    }),
    columnHelper.accessor("lines", {
      header: h.t("Items", "العناصر"),
      cell: (info) => `${info.getValue().length} ${h.t("items", "عنصر")}`,
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const label = STATUS_LABELS[status] ?? { en: status, ar: status, variant: "outline" as const };
        return <Badge variant={label.variant}>{h.t(label.en, label.ar)}</Badge>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const t = info.row.original;
        const canAct = h.canManage && (t.status === "draft" || t.status === "pending");
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canAct && (
                <DropdownMenuItem onClick={() => h.onEdit(t)}>
                  <Pencil className="size-4" /> {h.t("Edit", "تعديل")}
                </DropdownMenuItem>
              )}
              {h.canComplete && t.status === "in_transit" && (
                <DropdownMenuItem onClick={() => h.onComplete(t)}>
                  <CheckCircle className="size-4" /> {h.t("Complete", "إتمام")}
                </DropdownMenuItem>
              )}
              {h.canManage && (t.status === "draft" || t.status === "pending" || t.status === "in_transit") && (
                <DropdownMenuItem onClick={() => h.onCancel(t)}>
                  <XCircle className="size-4" /> {h.t("Cancel", "إلغاء")}
                </DropdownMenuItem>
              )}
              {canAct && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onRemove(t)} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];
}

export function StockTransfersPage() {
  const items = useStockTransfersStore((s) => s.items);
  const add = useStockTransfersStore((s) => s.add);
  const update = useStockTransfersStore((s) => s.update);
  const remove = useStockTransfersStore((s) => s.remove);
  const products = useProductsStore((s) => s.items);
  const warehouses = useWarehousesStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StockTransfer | null>(null);
  const [deleting, setDeleting] = useState<StockTransfer | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("stock-transfers.create");
  const canManage = usePermission("stock-transfers.update");
  const canComplete = usePermission("stock-transfers.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((tr) =>
      [tr.number, tr.fromWarehouseName ?? "", tr.toWarehouseName ?? "", tr.status]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  const handleSave = async (tr: StockTransfer) => {
    try {
      if (items.some((x) => x.id === tr.id)) {
        const updated = await stockTransfersApi().update(tr.id, {
          fromWarehouseId: tr.fromWarehouseId,
          toWarehouseId: tr.toWarehouseId,
          transferDate: tr.transferDate,
          notes: tr.notes,
        });
        update(tr.id, updated);
      } else {
        const created = await stockTransfersApi().create({
          fromWarehouseId: tr.fromWarehouseId,
          toWarehouseId: tr.toWarehouseId,
          transferDate: tr.transferDate,
          lines: tr.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          notes: tr.notes,
        });
        add(created);
      }
      toast.success(t("Transfer saved", "تم حفظ التحويل"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Save failed", "فشل الحفظ"));
    }
  };

  const handleComplete = async (tr: StockTransfer) => {
    try {
      const completed = await stockTransfersApi().complete(tr.id);
      update(tr.id, completed);
      toast.success(t("Transfer completed", "تم إتمام التحويل"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Operation failed", "فشلت العملية"));
    }
  };

  const handleCancel = async (tr: StockTransfer) => {
    try {
      const cancelled = await stockTransfersApi().cancel(tr.id);
      update(tr.id, cancelled);
      toast.success(t("Transfer cancelled", "تم إلغاء التحويل"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Operation failed", "فشلت العملية"));
    }
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await stockTransfersApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Transfer deleted", "تم حذف التحويل"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<StockTransfer, any>[]>(
    () =>
      buildColumns({
        onEdit: setEditing,
        onRemove: (tr) => { setDeleting(tr); setConfirmOpen(true); },
        onComplete: handleComplete,
        onCancel: handleCancel,
        canManage,
        canComplete,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, canComplete, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Stock Transfers", "نقل بين المخازن")}
        description={t("Transfer inventory between warehouses.", "نقل المخزون بين المخازن.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("New transfer", "تحويل جديد")}
          </Button>
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
                  placeholder={t("Search transfers…", "ابحث عن تحويلات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("transfers", "تحويل")}</div>
              </div>
            }
            emptyTitle={t("No transfers", "لا توجد تحويلات")}
            emptyDescription={t("Create a stock transfer to move inventory between warehouses.", "إنشاء تحويل مخزون لنقل المخزون بين المخازن.")}
          />
        )}
      </div>

      <StockTransferFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        transfer={editing}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete transfer?", "حذف التحويل؟")}
        description={t("This will permanently remove this transfer.", "سيؤدي هذا إلى حذف هذا التحويل نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function StockTransferFormDialog({
  open,
  onOpenChange,
  transfer,
  products,
  warehouses,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransfer | null;
  products: Array<{ id: string; name: string; sku?: string }>;
  warehouses: Array<{ id: string; name: string }>;
  onSave: (tr: StockTransfer) => void;
}) {
  const { t } = useT();
  const [fromWarehouseId, setFromWarehouseId] = useState(transfer?.fromWarehouseId ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(transfer?.toWarehouseId ?? "");
  const [transferDate, setTransferDate] = useState(transfer?.transferDate ?? new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<StockTransferLine[]>(transfer?.lines ?? []);
  const [lineProductId, setLineProductId] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [notes, setNotes] = useState(transfer?.notes ?? "");

  const isEdit = Boolean(transfer);

  const addLine = () => {
    if (!lineProductId || lineQty <= 0) return;
    const product = products.find((p) => p.id === lineProductId);
    setLines((prev) => [
      ...prev,
      { id: `line-${Date.now()}`, productId: lineProductId, productName: product?.name, quantity: lineQty },
    ]);
    setLineProductId("");
    setLineQty(1);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = () => {
    const fromWh = warehouses.find((w) => w.id === fromWarehouseId);
    const toWh = warehouses.find((w) => w.id === toWarehouseId);
    const record: StockTransfer = {
      id: transfer?.id ?? `st-${Date.now()}`,
      number: transfer?.number ?? `ST-${Date.now()}`,
      fromWarehouseId,
      fromWarehouseName: fromWh?.name,
      toWarehouseId,
      toWarehouseName: toWh?.name,
      status: transfer?.status ?? "draft",
      transferDate,
      lines,
      notes,
      createdBy: transfer?.createdBy ?? "",
      createdAt: transfer?.createdAt ?? new Date().toISOString(),
    };
    onSave(record);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Edit Transfer", "تعديل التحويل") : t("New Transfer", "تحويل جديد")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("From Warehouse", "من المخزن")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
              >
                <option value="">{t("Select…", "اختر…")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("To Warehouse", "إلى المخزن")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
              >
                <option value="">{t("Select…", "اختر…")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Transfer Date", "تاريخ التحويل")}</Label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("Line Items", "البنود")}</Label>
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{line.productName ?? line.productId}</span>
                <span className="tabular-nums text-sm">{line.quantity}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => removeLine(line.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <select
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={lineProductId}
                onChange={(e) => setLineProductId(e.target.value)}
              >
                <option value="">{t("Select product…", "اختر منتجاً…")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                value={lineQty}
                onChange={(e) => setLineQty(Number(e.target.value))}
                className="w-24"
              />
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("Notes", "ملاحظات")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Optional notes", "ملاحظات اختيارية")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} disabled={!fromWarehouseId || !toWarehouseId || lines.length === 0}>
            {isEdit ? t("Save", "حفظ") : t("Create", "إنشاء")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
