import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Pencil, Trash2, Coins, Star,
} from "lucide-react";
import { useCurrenciesStore } from "@/stores/currencies-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { currenciesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { CurrencyRate } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const columnHelper = createColumnHelper<CurrencyRate>();

interface Handlers {
  onEdit: (c: CurrencyRate) => void;
  onRemove: (c: CurrencyRate) => void;
  canManage: boolean;
}

function buildColumns(h: Handlers) {
  return [
    columnHelper.accessor("code", {
      header: "Code",
      cell: (info) => {
        const c = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Coins className="size-4" />
            </div>
            <div>
              <p className="font-medium">{c.code}</p>
              <p className="text-xs text-muted-foreground">{c.name}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("symbol", { header: "Symbol", cell: (info) => info.getValue() || "—" }),
    columnHelper.accessor("rate", {
      header: "Rate (per 1 unit)",
      cell: (info) => (
        <span className="tabular-nums">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("isBase", {
      header: "Base",
      cell: (info) =>
        info.getValue() ? (
          <Badge variant="success" dot>Base</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const c = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {h.canManage && !c.isBase ? (
                <>
                  <DropdownMenuItem onClick={() => h.onEdit(c)}>
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onRemove(c)} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4" /> Delete
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

export function CurrenciesPage() {
  const items = useCurrenciesStore((s) => s.items);
  const add = useCurrenciesStore((s) => s.add);
  const update = useCurrenciesStore((s) => s.update);
  const remove = useCurrenciesStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CurrencyRate | null>(null);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", rate: "1", isBase: false });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CurrencyRate | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("currencies.create");
  const canManage = usePermission("currencies.update");
  const loading = useSimulatedLoading(500, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => [c.code, c.name, c.symbol].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", symbol: "", rate: "1", isBase: false });
    setDialogOpen(true);
  };

  const openEdit = (c: CurrencyRate) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name ?? "", symbol: c.symbol ?? "", rate: String(c.rate), isBase: Boolean(c.isBase) });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.code.trim()) {
      toast.error(t("Code is required", "الكود مطلوب"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim() || undefined,
        symbol: form.symbol.trim() || undefined,
        rate: Number(form.rate) || 0,
        isBase: form.isBase,
      };
      const record = editing
        ? await currenciesApi().update(editing.id, payload)
        : await currenciesApi().create(payload);
      if (editing) update(record.id, record);
      else add(record);
      setDialogOpen(false);
      toast.success(
        editing
          ? t("Currency updated", "تم تحديث العملة")
          : t("Currency added", "تمت إضافة العملة"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Save failed", "فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await currenciesApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Currency deleted", "تم حذف العملة"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo(
    () => buildColumns({ onEdit: openEdit, onRemove: (c) => { setDeleting(c); setConfirmOpen(true); }, canManage }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Currencies", "العملات")}
        description={t("Manage exchange rates used across documents.", "إدارة أسعار الصرف المستخدمة في المستندات.")}
      >
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("Add currency", "إضافة عملة")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={5} columns={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search currencies…", "ابحث عن العملات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("currencies", "عملة")}</div>
              </div>
            }
            emptyTitle={t("No currencies yet", "لا توجد عملات بعد")}
            emptyDescription={t("Add a currency exchange rate to invoice in other currencies.", "أضف سعر صرف للفوترة بعملات أخرى.")}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("Edit currency", "تعديل عملة") : t("Add currency", "إضافة عملة")}
            </DialogTitle>
            <DialogDescription>
              {t("Rate is expressed as units of the base currency per 1 unit of this currency.", "يُعبَّر عن السعر بوحدات العملة الأساسية مقابل وحدة واحدة من هذه العملة.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Code", "الكود")} *</Label>
                <Input
                  value={form.code}
                  maxLength={3}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="USD"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Symbol", "الرمز")}</Label>
                <Input
                  value={form.symbol}
                  maxLength={10}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                  placeholder="$"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Rate", "السعر")} *</Label>
                <Input
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Name", "الاسم")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("US Dollar", "دولار أمريكي")}
              />
            </div>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <Star className="size-4 text-warning" />
                {t("Set as base currency", "تعيين كعملة أساسية")}
              </span>
              <Switch
                checked={Boolean(form.isBase)}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isBase: v }))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {saving
                ? t("Saving…", "جارٍ الحفظ…")
                : editing
                  ? t("Save changes", "حفظ التغييرات")
                  : t("Add currency", "إضافة عملة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete currency?", "حذف العملة؟")}
        description={t("This will remove the exchange rate. Existing documents are not affected.", "سيؤدي هذا إلى حذف سعر الصرف. المستندات الحالية لا تتأثر.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}