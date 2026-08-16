import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, Calculator, Boxes, TrendingDown,
} from "lucide-react";
import { useAssetsStore } from "@/stores/assets-store";
import { useAccountsStore } from "@/stores/accounting-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { assetsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { Asset, AssetDepreciationRun } from "@/types/domain";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { AssetFormDialog } from "./asset-form-dialog";

const columnHelper = createColumnHelper<Asset>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

interface Handlers {
  onEdit: (a: Asset) => void;
  onDepreciate: (a: Asset) => void;
  onRemove: (a: Asset) => void;
  onOpenRuns: (a: Asset) => void;
  canManage: boolean;
  canDepreciate: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<Asset, any>[] {
  return [
    columnHelper.accessor("code", {
      header: h.t("Code", "الكود"),
      cell: (info) => {
        const a = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Boxes className="size-4" />
            </div>
            <div>
              <p className="font-medium">{a.code}</p>
              <p className="text-xs text-muted-foreground">{a.name}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("category", {
      header: h.t("Category", "الفئة"),
      cell: (info) => info.getValue() ?? h.t("Uncategorized", "بدون فئة"),
    }),
    columnHelper.accessor("purchaseDate", {
      header: h.t("Purchased", "تاريخ الشراء"),
      cell: (info) => (info.getValue() ? formatDate(info.getValue()) : "—"),
    }),
    columnHelper.accessor("cost", {
      header: h.t("Cost", "التكلفة"),
      cell: (info) => <span className="tabular-nums">{money(info.getValue())}</span>,
    }),
    columnHelper.accessor("bookValue", {
      header: h.t("Book value", "القيمة الدفترية"),
      cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
    }),
    columnHelper.accessor("usefulLifeMonths", {
      header: h.t("Life (mo)", "العمر (شهر)"),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("depreciationMethod", {
      header: h.t("Method", "الطريقة"),
      cell: (info) =>
        info.getValue() === "declining"
          ? h.t("Declining", "متناقص")
          : h.t("Straight-line", "قسط ثابت"),
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => (
        <Badge variant={info.getValue() === "active" ? "success" : "muted"} dot>
          {info.getValue() === "active" ? h.t("Active", "نشط") : h.t("Disposed", "مُصفّى")}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const a = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onOpenRuns(a)}>
                <TrendingDown className="size-4" /> {h.t("Depreciation runs", "جولات الإهلاك")}
              </DropdownMenuItem>
              {h.canDepreciate && a.status === "active" ? (
                <DropdownMenuItem onClick={() => h.onDepreciate(a)}>
                  <Calculator className="size-4" /> {h.t("Run depreciation", "تشغيل الإهلاك")}
                </DropdownMenuItem>
              ) : null}
              {h.canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onEdit(a)}>
                    <Plus className="size-4" /> {h.t("Edit", "تعديل")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => h.onRemove(a)} className="text-destructive focus:text-destructive">
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

export function AssetsPage() {
  const items = useAssetsStore((s) => s.items);
  const add = useAssetsStore((s) => s.add);
  const update = useAssetsStore((s) => s.update);
  const remove = useAssetsStore((s) => s.remove);
  const accounts = useAccountsStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [depreciating, setDepreciating] = useState<Asset | null>(null);
  const [depreciatingBusy, setDepreciatingBusy] = useState(false);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [runs, setRuns] = useState<AssetDepreciationRun[] | null>(null);

  const canCreate = usePermission("assets.create");
  const canManage = usePermission("assets.update");
  const canDepreciate = usePermission("assets.depreciate");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => [a.code, a.name, a.category ?? ""].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const handleSave = (asset: Asset) => {
    if (items.some((a) => a.id === asset.id)) update(asset.id, asset);
    else add(asset);
  };

  const confirmDepreciate = async () => {
    if (!depreciating) return;
    setDepreciatingBusy(true);
    try {
      const result = await assetsApi().depreciate(depreciating.id);
      update(result.id, result);
      toast.success(t("Depreciation recorded", "تم تسجيل الإهلاك"));
      setDepreciating(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Depreciation failed", "فشل تسجيل الإهلاك"));
    } finally {
      setDepreciatingBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await assetsApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Asset deleted", "تم حذف الأصل"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<Asset, any>[]>(
    () =>
      buildColumns({
        onEdit: setEditing,
        onDepreciate: setDepreciating,
        onRemove: (a) => { setDeleting(a); setConfirmOpen(true); },
        onOpenRuns: (a) => setRuns(a.runs ?? []),
        canManage,
        canDepreciate,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, canDepreciate, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Fixed Assets", "الأصول الثابتة")}
        description={t("Register assets and run depreciation.", "سجّل الأصول واحتسب الإهلاك.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Register asset", "تسجيل أصل")}
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
                  placeholder={t("Search assets…", "ابحث عن الأصول…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("assets", "أصل")}</div>
              </div>
            }
            emptyTitle={t("No assets yet", "لا توجد أصول بعد")}
            emptyDescription={t("Register a fixed asset to track depreciation over time.", "سجّل أصلاً ثابتاً لتتبع إهلاكه بمرور الوقت.")}
          />
        )}
      </div>

      <AssetFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        asset={editing}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, code: a.code }))}
        onSave={handleSave}
      />

      <Dialog open={Boolean(depreciating)} onOpenChange={(open) => { if (!open) setDepreciating(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Run depreciation", "تشغيل الإهلاك")}</DialogTitle>
            <DialogDescription>
              {depreciating
                ? `${t("Asset", "الأصل")} ${depreciating.code} — ${t("book value", "القيمة الدفترية")} ${money(depreciating.bookValue ?? 0)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDepreciating(null)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={confirmDepreciate} loading={depreciatingBusy}>
              <Calculator className="size-4" />
              {t("Run for current month", "تشغيل للشهر الحالي")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runs !== null} onOpenChange={(open) => { if (!open) setRuns(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Depreciation runs", "جولات الإهلاك")}</DialogTitle>
          </DialogHeader>
          {runs && runs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Period", "الفترة")}</TableHead>
                  <TableHead className="text-end">{t("Amount", "المبلغ")}</TableHead>
                  <TableHead className="text-end">{t("Book value", "القيمة الدفترية")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.period}</TableCell>
                    <TableCell className="text-end tabular-nums">{money(r.amount)}</TableCell>
                    <TableCell className="text-end tabular-nums">{money(r.bookValueAfter)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("No depreciation has been recorded for this asset yet.", "لم يُسجَّل أي إهلاك لهذا الأصل بعد.")}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuns(null)}>
              {t("Close", "إغلاق")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete asset?", "حذف الأصل؟")}
        description={t("This will permanently remove the asset and its depreciation history.", "سيؤدي هذا إلى حذف الأصل وسجل إهلاكه نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}