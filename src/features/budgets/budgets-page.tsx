import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, Pencil, PieChart,
} from "lucide-react";
import { useBudgetsStore } from "@/stores/budgets-store";
import { useAccountsStore } from "@/stores/accounting-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { budgetsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { Budget } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
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

const columnHelper = createColumnHelper<Budget>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildColumns(h: {
  onEdit: (b: Budget) => void;
  onRemove: (b: Budget) => void;
  canManage: boolean;
  t: TranslateFn;
}): ColumnDef<Budget, any>[] {
  return [
    columnHelper.accessor("accountName", {
      header: h.t("Account", "الحساب"),
      cell: (info) => {
        const b = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PieChart className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? b.accountCode}</p>
              <p className="text-xs text-muted-foreground">{b.accountCode}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("period", {
      header: h.t("Period", "الفترة"),
    }),
    columnHelper.accessor("budgeted", {
      header: h.t("Budgeted", "الميزانية"),
      cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
    }),
    columnHelper.accessor("actual", {
      header: h.t("Actual", "الفعلي"),
      cell: (info) => <span className="tabular-nums">{money(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: "variance",
      header: h.t("Variance", "الانحراف"),
      cell: (info) => {
        const b = info.row.original;
        const variance = b.actual - b.budgeted;
        const pct = b.budgeted > 0 ? Math.round((b.actual / b.budgeted) * 100) : 0;
        return (
          <div className="space-y-1">
            <span className={`tabular-nums font-medium ${variance > 0 ? "text-red-600" : "text-green-600"}`}>
              {variance > 0 ? "+" : ""}{money(variance)}
            </span>
            <Progress value={Math.min(pct, 100)} className="h-1.5" />
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const b = info.row.original;
        return h.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onEdit(b)}>
                <Pencil className="size-4" /> {h.t("Edit", "تعديل")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => h.onRemove(b)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null;
      },
    }),
  ];
}

export function BudgetsPage() {
  const items = useBudgetsStore((s) => s.items);
  const add = useBudgetsStore((s) => s.add);
  const update = useBudgetsStore((s) => s.update);
  const remove = useBudgetsStore((s) => s.remove);
  const accounts = useAccountsStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("budgets.create");
  const canManage = usePermission("budgets.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) =>
      [b.accountName ?? "", b.accountCode ?? "", b.period].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const handleSave = (budget: Budget) => {
    if (items.some((b) => b.id === budget.id)) update(budget.id, budget);
    else add(budget);
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await budgetsApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Budget deleted", "تم حذف الميزانية"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<Budget, any>[]>(
    () =>
      buildColumns({
        onEdit: setEditing,
        onRemove: (b) => { setDeleting(b); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Budgets", "الميزانيات")}
        description={t("Set and track budgets per account per period.", "تحديد ومتابعة الميزانيات لكل حساب لكل فترة.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Add budget", "إضافة ميزانية")}
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
                  placeholder={t("Search budgets…", "ابحث عن الميزانيات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("budgets", "ميزانية")}</div>
              </div>
            }
            emptyTitle={t("No budgets yet", "لا توجد ميزانيات بعد")}
            emptyDescription={t("Create a budget to track actual vs planned spending.", "أنشئ ميزانية لتتبع الإنفاق الفعلي مقابل المخطط.")}
          />
        )}
      </div>

      <BudgetFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        budget={editing}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, code: a.code }))}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete budget?", "حذف الميزانية؟")}
        description={t("This will permanently remove this budget entry.", "سيؤدي هذا إلى حذف هذا السجل نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  accounts,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  accounts: Array<{ id: string; name: string; code: string }>;
  onSave: (b: Budget) => void;
}) {
  const { t } = useT();
  const [accountId, setAccountId] = useState(budget?.accountId ?? "");
  const [period, setPeriod] = useState(budget?.period ?? "");
  const [budgeted, setBudgeted] = useState(budget?.budgeted ?? 0);
  const [notes, setNotes] = useState(budget?.notes ?? "");

  const isEdit = Boolean(budget);

  const handleSave = () => {
    const account = accounts.find((a) => a.id === accountId);
    const record: Budget = {
      id: budget?.id ?? `budget-${Date.now()}`,
      accountId,
      accountCode: account?.code,
      accountName: account?.name,
      period,
      budgeted,
      actual: budget?.actual ?? 0,
      notes,
      createdAt: budget?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(record);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Edit Budget", "تعديل الميزانية") : t("New Budget", "ميزانية جديدة")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Account", "الحساب")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t("Select account…", "اختر حساباً…")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Period", "الفترة")}</Label>
            <Input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder={t("e.g. 2026-Q1", "مثلاً: 2026-Q1")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Budgeted Amount", "المبلغ المخطط)")}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={budgeted || ""}
              onChange={(e) => setBudgeted(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Notes", "ملاحظات")}</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("Optional notes", "ملاحظات اختيارية")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} disabled={!accountId || !period || budgeted <= 0}>
            {isEdit ? t("Save", "حفظ") : t("Create", "إنشاء")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
