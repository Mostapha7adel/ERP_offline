import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2, RotateCcw } from "lucide-react";
import { usePurchaseReturnsStore } from "@/stores/purchase-returns-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { formatDate, formatCurrency } from "@/lib/format";
import { purchaseReturnsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { PurchaseReturn } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const columnHelper = createColumnHelper<PurchaseReturn>();

interface Handlers {
  onEdit: (r: PurchaseReturn) => void;
  onRemove: (r: PurchaseReturn) => void;
  canManage: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<PurchaseReturn, any>[] {
  return [
    columnHelper.accessor("number", {
      header: h.t("Number", "الرقم"),
      cell: (info) => {
        const r = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <RotateCcw className="size-4" />
            </div>
            <div>
              <p className="font-medium font-mono text-xs">{r.number}</p>
              <p className="text-xs text-muted-foreground">{r.invoiceNumber ?? "—"}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("supplierName", {
      header: h.t("Supplier", "المورد"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("total", {
      header: h.t("Total", "الإجمالي"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("returnDate", {
      header: h.t("Return date", "تاريخ المرتجع"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const variant = status === "issued" ? "success" : status === "cancelled" ? "destructive" : "warning";
        return (
          <Badge variant={variant} dot className="capitalize">
            {status === "issued" ? h.t("Issued", "صادر") : status === "cancelled" ? h.t("Cancelled", "ملغى") : h.t("Draft", "مسودة")}
          </Badge>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {h.canManage ? (
              <>
                <DropdownMenuItem onClick={() => h.onEdit(info.row.original)}>
                  <Plus className="size-4" /> {h.t("Edit", "تعديل")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => h.onRemove(info.row.original)} className="text-destructive focus:text-destructive">
                  <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ];
}

export function PurchaseReturnsPage() {
  const items = usePurchaseReturnsStore((s) => s.items);
  const add = usePurchaseReturnsStore((s) => s.add);
  const update = usePurchaseReturnsStore((s) => s.update);
  const remove = usePurchaseReturnsStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseReturn | null>(null);
  const [deleting, setDeleting] = useState<PurchaseReturn | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [formSupplier, setFormSupplier] = useState("");
  const [formInvoiceNum, setFormInvoiceNum] = useState("");
  const [formReturnDate, setFormReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTotal, setFormTotal] = useState(0);
  const [formReason, setFormReason] = useState("");
  const [_formStatus, setFormStatus] = useState<"draft" | "issued" | "cancelled">("draft");

  const canCreate = usePermission("purchases.create");
  const canManage = usePermission("purchases.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      [r.number, r.supplierName ?? "", r.invoiceNumber ?? "", r.reason ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const issued = items.filter((r) => r.status === "issued");
    return { count: issued.length, total: issued.reduce((s, r) => s + r.total, 0) };
  }, [items]);

  const resetForm = () => {
    setFormSupplier("");
    setFormInvoiceNum("");
    setFormReturnDate(new Date().toISOString().slice(0, 10));
    setFormTotal(0);
    setFormReason("");
    setFormStatus("draft");
  };

  const openEdit = (r: PurchaseReturn) => {
    setFormSupplier(r.supplierName ?? "");
    setFormInvoiceNum(r.invoiceNumber ?? "");
    setFormReturnDate(r.returnDate.slice(0, 10));
    setFormTotal(r.total);
    setFormReason(r.reason ?? "");
    setFormStatus(r.status);
    setEditing(r);
  };

  const handleSave = async () => {
    const input = {
      supplierId: editing?.supplierId ?? "",
      returnDate: formReturnDate,
      lines: [],
      reason: formReason,
    };

    if (editing) {
      try {
        const updated = await purchaseReturnsApi().update(editing.id, input);
        update(updated.id, updated);
        toast.success(t("Return updated", "تم تحديث المرتجع"));
      } catch {
        toast.error(t("Update failed", "فشل التحديث"));
      }
    } else {
      try {
        const created = await purchaseReturnsApi().create(input);
        add(created);
        toast.success(t("Return created", "تم إنشاء المرتجع"));
      } catch {
        toast.error(t("Creation failed", "فشل الإنشاء"));
      }
    }
    setCreateOpen(false);
    setEditing(null);
    resetForm();
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await purchaseReturnsApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Return deleted", "تم حذف المرتجع"));
      } catch {
        toast.error(t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<PurchaseReturn, any>[]>(
    () =>
      buildColumns({
        onEdit: openEdit,
        onRemove: (r) => { setDeleting(r); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  const dialogTitle = editing ? t("Edit return", "تعديل المرتجع") : t("New purchase return", "مرتجع مشتريات جديد");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Purchase Returns", "مرتجعات المشتريات")}
        description={t("Manage returns to suppliers.", "إدارة المرتجعات للموردين.")}
      >
        {canCreate ? (
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="size-4" />
            {t("New return", "مرتجع جديد")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Issued returns", "المرتجعات الصادرة")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warning">{totals.count}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total value", "القيمة الإجمالية")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(totals.total)}</p>
        </Card>
      </div>

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
                  placeholder={t("Search returns…", "ابحث عن المرتجعات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("returns", "مرتجع")}</div>
              </div>
            }
            emptyTitle={t("No returns yet", "لا توجد مرتجعات بعد")}
            emptyDescription={t("Create a purchase return to record items returned to suppliers.", "أنشئ مرتجع مشتريات لتسجيل المنتجات المعادة للموردين.")}
          />
        )}
      </div>

      <Dialog open={createOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{t("Enter return details.", "أدخل تفاصيل المرتجع.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t("Supplier name", "اسم المورد")}
              value={formSupplier}
              onChange={(e) => setFormSupplier(e.target.value)}
            />
            <Input
              placeholder={t("Original invoice number", "رقم الفاتورة الأصلية")}
              value={formInvoiceNum}
              onChange={(e) => setFormInvoiceNum(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={formReturnDate}
                onChange={(e) => setFormReturnDate(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder={t("Total amount", "المبلغ الإجمالي")}
                value={formTotal || ""}
                onChange={(e) => setFormTotal(Number(e.target.value))}
              />
            </div>
            <Input
              placeholder={t("Return reason", "سبب المرتجع")}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditing(null); resetForm(); }}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={handleSave}>
              {editing ? t("Save", "حفظ") : t("Create", "إنشاء")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete return?", "حذف المرتجع؟")}
        description={t("This will permanently remove the purchase return.", "سيؤدي هذا إلى حذف مرتجع المشتريات نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
