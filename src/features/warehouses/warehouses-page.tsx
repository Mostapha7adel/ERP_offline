import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, Pencil, Trash2, MoreHorizontal, Users, Warehouse as WarehouseIcon,
} from "lucide-react";
import { useWarehousesStore } from "@/stores/inventory-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { warehousesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { Warehouse } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { WarehouseFormDialog } from "./warehouse-form-dialog";
import { Progress } from "@/shared/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const columnHelper = createColumnHelper<Warehouse>();

function capacityUsed(stock: { warehouseId: string; quantity: number }[], id: string) {
  return stock.filter((s) => s.warehouseId === id).reduce((sum, s) => sum + s.quantity, 0);
}

interface Handlers {
  onEdit: (w: Warehouse) => void;
  onRemove: (w: Warehouse) => void;
  onToggle: (w: Warehouse) => void;
  canManage: boolean;
  usedOf: (id: string) => number;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<Warehouse, any>[] {
  return [
    columnHelper.accessor("name", {
      header: h.t("Warehouse", "المستودع"),
      cell: (info) => {
        const w = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <WarehouseIcon className="size-4" />
            </div>
            <div>
              <p className="font-medium">{w.name}</p>
              <p className="text-xs text-muted-foreground">{w.code}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("location", { header: h.t("Location", "الموقع"), cell: (info) => info.getValue() }),
    columnHelper.accessor("manager", {
      header: h.t("Manager", "المدير"),
      cell: (info) => (
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" />
          {info.getValue() || h.t("Unassigned", "غير معيّن")}
        </span>
      ),
    }),
    columnHelper.display({
      id: "capacity",
      header: h.t("Capacity usage", "استخدام السعة"),
      cell: (info) => {
        const w = info.row.original;
        const used = h.usedOf(w.id);
        const pct = w.capacity > 0 ? (used / w.capacity) * 100 : 0;
        return (
          <div className="w-36">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{used} {h.t("units", "وحدة")}</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <Progress
              value={pct}
              variant={pct > 90 ? "destructive" : pct > 70 ? "warning" : "default"}
              className="mt-1"
            />
          </div>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => (
        <Badge variant={info.getValue() === "active" ? "success" : "muted"} dot>
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: h.t("Created", "تاريخ الإنشاء"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const w = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {h.canManage ? (
                <>
                  <DropdownMenuItem onClick={() => h.onEdit(w)}>
                    <Pencil className="size-4" /> {h.t("Edit", "تعديل")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => h.onToggle(w)} className="text-warning focus:text-warning">
                    {w.status === "active" ? h.t("Deactivate", "إلغاء التنشيط") : h.t("Activate", "تنشيط")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onRemove(w)} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];
}

export function WarehousesPage() {
  const items = useWarehousesStore((s) => s.items);
  const add = useWarehousesStore((s) => s.add);
  const update = useWarehousesStore((s) => s.update);
  const remove = useWarehousesStore((s) => s.remove);
  const stock = useInventoryStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("warehouses.create");
  const canManage = usePermission("warehouses.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) => [w.name, w.code, w.location, w.manager].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const handleSave = (warehouse: Warehouse) => {
    if (items.some((w) => w.id === warehouse.id)) update(warehouse.id, warehouse);
    else add(warehouse);
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await warehousesApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("${name} deleted", "تم حذف ${name}").replace("${name}", deleting.name));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const toggleStatus = async (w: Warehouse) => {
    const next = w.status === "active" ? "inactive" : "active";
    try {
      const updated = await warehousesApi().update(w.id, { status: next });
      update(updated.id, updated);
      toast.success(
        `${updated.name} ${
          next === "active" ? t("activated", "تم تنشيطه") : t("deactivated", "تم إلغاء تنشيطه")
        }`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Update failed", "فشل التحديث"));
    }
  };

  const columns = useMemo<ColumnDef<Warehouse, any>[]>(
    () => buildColumns({
      onEdit: setEditing,
      onRemove: (w) => { setDeleting(w); setConfirmOpen(true); },
      onToggle: toggleStatus,
      canManage,
      usedOf: (id) => capacityUsed(stock, id),
      t,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, stock, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Warehouses", "المستودعات")}
        description={t("Manage locations where inventory is stored.", "إدارة المواقع التي يُخزَّن فيها المخزون.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Add warehouse", "إضافة مستودع")}
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
                  placeholder={t("Search warehouses…", "ابحث عن المستودعات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("warehouses", "مستودعاً")}</div>
              </div>
            }
            emptyTitle={t("No warehouses yet", "لا توجد مستودعات بعد")}
            emptyDescription={t("Add a warehouse location to begin tracking stock.", "أضف موقع مستودع لبدء تتبع المخزون.")}
          />
        )}
      </div>

      <WarehouseFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        warehouse={editing}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete ${name}?", "حذف ${name}؟").replace("${name}", deleting?.name ?? t("warehouse", "المستودع"))}
        description={t("This will remove the location. Stock will no longer be tracked here.", "سيؤدي هذا إلى إزالة الموقع. لن يتم تتبع المخزون هنا بعد الآن.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}