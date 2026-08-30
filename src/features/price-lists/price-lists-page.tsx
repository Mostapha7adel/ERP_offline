import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2, Tag, List } from "lucide-react";
import { usePriceListsStore } from "@/stores/price-lists-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { priceListsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { PriceList } from "@/types/domain";
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

const columnHelper = createColumnHelper<PriceList>();

interface Handlers {
  onEdit: (p: PriceList) => void;
  onRemove: (p: PriceList) => void;
  canManage: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<PriceList, any>[] {
  return [
    columnHelper.accessor("code", {
      header: h.t("Code", "الكود"),
      cell: (info) => {
        const p = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="size-4" />
            </div>
            <div>
              <p className="font-medium font-mono text-xs">{p.code}</p>
              <p className="text-xs text-muted-foreground">{p.name}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("currency", {
      header: h.t("Currency", "العملة"),
      cell: (info) => info.getValue(),
    }),
    columnHelper.display({
      id: "itemsCount",
      header: h.t("Items", "الأصناف"),
      cell: (info) => {
        const count = info.row.original.items.length;
        return (
          <Badge variant="outline">
            <List className="size-3 mr-1" />
            {count} {h.t("items", "صنف")}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        return (
          <Badge variant={status === "active" ? "success" : "muted"} dot className="capitalize">
            {status === "active" ? h.t("Active", "نشط") : h.t("Inactive", "غير نشط")}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: h.t("Created", "تاريخ الإنشاء"),
      cell: (info) => formatDate(info.getValue()),
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

export function PriceListsPage() {
  const items = usePriceListsStore((s) => s.items);
  const add = usePriceListsStore((s) => s.add);
  const update = usePriceListsStore((s) => s.update);
  const remove = usePriceListsStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PriceList | null>(null);
  const [deleting, setDeleting] = useState<PriceList | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCurrency, setFormCurrency] = useState("EGP");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formNotes, setFormNotes] = useState("");

  const canCreate = usePermission("products.create");
  const canManage = usePermission("products.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.code, p.name, p.currency].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const active = items.filter((p) => p.status === "active");
    return { active: active.length, total: items.length, totalItems: items.reduce((s, p) => s + p.items.length, 0) };
  }, [items]);

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormCurrency("EGP");
    setFormStatus("active");
    setFormNotes("");
  };

  const openEdit = (p: PriceList) => {
    setFormName(p.name);
    setFormCode(p.code);
    setFormCurrency(p.currency);
    setFormStatus(p.status);
    setFormNotes(p.notes ?? "");
    setEditing(p);
  };

  const handleSave = async () => {
    const input = {
      name: formName,
      code: formCode,
      currency: formCurrency,
      items: editing?.items ?? [],
      status: formStatus,
      notes: formNotes,
    };

    if (editing) {
      try {
        const updated = await priceListsApi().update(editing.id, input);
        update(updated.id, updated);
        toast.success(t("Price list updated", "تم تحديث قائمة الأسعار"));
      } catch {
        toast.error(t("Update failed", "فشل التحديث"));
      }
    } else {
      try {
        const created = await priceListsApi().create(input);
        add(created);
        toast.success(t("Price list created", "تم إنشاء قائمة الأسعار"));
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
        await priceListsApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Price list deleted", "تم حذف قائمة الأسعار"));
      } catch {
        toast.error(t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<PriceList, any>[]>(
    () =>
      buildColumns({
        onEdit: openEdit,
        onRemove: (p) => { setDeleting(p); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  const dialogTitle = editing ? t("Edit price list", "تعديل قائمة الأسعار") : t("New price list", "قائمة أسعار جديدة");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Price Lists", "قوائم الأسعار")}
        description={t("Manage product price lists and pricing tiers.", "إدارة قوائم أسعار المنتجات ومستويات الأسعار.")}
      >
        {canCreate ? (
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="size-4" />
            {t("New price list", "قائمة أسعار جديدة")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Active lists", "القوائم النشطة")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{totals.active}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total lists", "إجمالي القوائم")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total items", "إجمالي الأصناف")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totals.totalItems}</p>
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
                  placeholder={t("Search price lists…", "ابحث عن قوائم الأسعار…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("lists", "قائمة")}</div>
              </div>
            }
            emptyTitle={t("No price lists yet", "لا توجد قوائم أسعار بعد")}
            emptyDescription={t("Create a price list to manage product pricing tiers.", "أنشئ قائمة أسعار لإدارة مستويات أسعار المنتجات.")}
          />
        )}
      </div>

      <Dialog open={createOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{t("Enter price list details.", "أدخل تفاصيل قائمة الأسعار.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={t("List name", "اسم القائمة")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={t("Code", "الكود")}
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
              />
              <Input
                placeholder={t("Currency", "العملة")}
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
              />
            </div>
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
            <Button onClick={handleSave} disabled={!formName || !formCode}>
              {editing ? t("Save", "حفظ") : t("Create", "إنشاء")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete price list?", "حذف قائمة الأسعار؟")}
        description={t("This will permanently remove the price list and its items.", "سيؤدي هذا إلى حذف قائمة الأسعار وأصنافها نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
