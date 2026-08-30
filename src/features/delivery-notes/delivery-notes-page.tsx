import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2, Truck, Package } from "lucide-react";
import { useDeliveryNotesStore } from "@/stores/delivery-notes-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { deliveryNotesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { DeliveryNote } from "@/types/domain";
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

const columnHelper = createColumnHelper<DeliveryNote>();

interface Handlers {
  onEdit: (n: DeliveryNote) => void;
  onRemove: (n: DeliveryNote) => void;
  canManage: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<DeliveryNote, any>[] {
  return [
    columnHelper.accessor("number", {
      header: h.t("Number", "الرقم"),
      cell: (info) => {
        const n = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-info/10 text-info">
              <Truck className="size-4" />
            </div>
            <div>
              <p className="font-medium font-mono text-xs">{n.number}</p>
              <p className="text-xs text-muted-foreground">{n.orderNumber ?? "—"}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("supplierName", {
      header: h.t("Supplier", "المورد"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("warehouseName", {
      header: h.t("Warehouse", "المخزن"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.display({
      id: "itemsCount",
      header: h.t("Items", "الأصناف"),
      cell: (info) => {
        const count = info.row.original.lines.length;
        return (
          <Badge variant="outline">
            <Package className="size-3 mr-1" />
            {count}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("expectedDate", {
      header: h.t("Expected", "التاريخ المتوقع"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const variant = status === "delivered" ? "success" : status === "cancelled" ? "destructive" : "warning";
        return (
          <Badge variant={variant} dot className="capitalize">
            {status === "delivered" ? h.t("Delivered", "تم التوريد") : status === "cancelled" ? h.t("Cancelled", "ملغى") : h.t("Pending", "قيد الانتظار")}
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

export function DeliveryNotesPage() {
  const items = useDeliveryNotesStore((s) => s.items);
  const add = useDeliveryNotesStore((s) => s.add);
  const update = useDeliveryNotesStore((s) => s.update);
  const remove = useDeliveryNotesStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryNote | null>(null);
  const [deleting, setDeleting] = useState<DeliveryNote | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [formSupplier, setFormSupplier] = useState("");
  const [formWarehouse, setFormWarehouse] = useState("");
  const [formExpectedDate, setFormExpectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formNotes, setFormNotes] = useState("");

  const canCreate = usePermission("purchases.create");
  const canManage = usePermission("purchases.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) =>
      [n.number, n.supplierName ?? "", n.warehouseName ?? "", n.orderNumber ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const pending = items.filter((n) => n.status === "pending");
    const delivered = items.filter((n) => n.status === "delivered");
    return { pending: pending.length, delivered: delivered.length };
  }, [items]);

  const resetForm = () => {
    setFormSupplier("");
    setFormWarehouse("");
    setFormExpectedDate(new Date().toISOString().slice(0, 10));
    setFormNotes("");
  };

  const openEdit = (n: DeliveryNote) => {
    setFormSupplier(n.supplierName ?? "");
    setFormWarehouse(n.warehouseName ?? "");
    setFormExpectedDate(n.expectedDate.slice(0, 10));
    setFormNotes(n.notes ?? "");
    setEditing(n);
  };

  const handleSave = async () => {
    const input = {
      supplierId: editing?.supplierId ?? "",
      warehouseId: editing?.warehouseId ?? "",
      expectedDate: formExpectedDate,
      lines: editing?.lines ?? [],
      notes: formNotes,
    };

    if (editing) {
      try {
        const updated = await deliveryNotesApi().update(editing.id, input);
        update(updated.id, updated);
        toast.success(t("Delivery note updated", "تم تحديث سند التوريد"));
      } catch {
        toast.error(t("Update failed", "فشل التحديث"));
      }
    } else {
      try {
        const created = await deliveryNotesApi().create(input);
        add(created);
        toast.success(t("Delivery note created", "تم إنشاء سند التوريد"));
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
        await deliveryNotesApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Delivery note deleted", "تم حذف سند التوريد"));
      } catch {
        toast.error(t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<DeliveryNote, any>[]>(
    () =>
      buildColumns({
        onEdit: openEdit,
        onRemove: (n) => { setDeleting(n); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  const dialogTitle = editing ? t("Edit delivery note", "تعديل سند التوريد") : t("New delivery note", "سند توريد جديد");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Delivery Notes", "سندات التوريد")}
        description={t("Track goods received from suppliers.", "تتبع البضائع المستلمة من الموردين.")}
      >
        {canCreate ? (
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="size-4" />
            {t("New delivery note", "سند توريد جديد")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Pending", "قيد الانتظار")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warning">{totals.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Delivered", "تم التوريد")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{totals.delivered}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total notes", "إجمالي السندات")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{items.length}</p>
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
                  placeholder={t("Search delivery notes…", "ابحث عن سندات التوريد…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("notes", "سند")}</div>
              </div>
            }
            emptyTitle={t("No delivery notes yet", "لا توجد سندات توريد بعد")}
            emptyDescription={t("Create a delivery note to track incoming goods from suppliers.", "أنشئ سند توريد لتتبع البضائع الواردة من الموردين.")}
          />
        )}
      </div>

      <Dialog open={createOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{t("Enter delivery note details.", "أدخل تفاصيل سند التوريد.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t("Supplier name", "اسم المورد")}
              value={formSupplier}
              onChange={(e) => setFormSupplier(e.target.value)}
            />
            <Input
              placeholder={t("Warehouse", "المخزن")}
              value={formWarehouse}
              onChange={(e) => setFormWarehouse(e.target.value)}
            />
            <Input
              type="date"
              value={formExpectedDate}
              onChange={(e) => setFormExpectedDate(e.target.value)}
            />
            <Input
              placeholder={t("Notes", "ملاحظات")}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
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
        title={t("Delete delivery note?", "حذف سند التوريد؟")}
        description={t("This will permanently remove the delivery note.", "سيؤدي هذا إلى حذف سند التوريد نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
