import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, Repeat, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { useRecurringStore } from "@/stores/recurring-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { formatCurrency, formatDate } from "@/lib/format";
import { recurringApi } from "@/lib/api";
import { hydrateInvoices, hydrateParties } from "@/lib/api/hydration";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { RecurringInvoice, Party, Product, Warehouse, RecurringFrequency } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { RecurringFormDialog } from "./recurring-form-dialog";

const columnHelper = createColumnHelper<RecurringInvoice>();

const frequencyLabel = (f: RecurringFrequency): { en: string; ar: string } => {
  switch (f) {
    case "daily": return { en: "Daily", ar: "يومي" };
    case "weekly": return { en: "Weekly", ar: "أسبوعي" };
    case "monthly": return { en: "Monthly", ar: "شهري" };
    case "quarterly": return { en: "Quarterly", ar: "ربع سنوي" };
    case "yearly": return { en: "Yearly", ar: "سنوي" };
  }
};

interface RecurringPageProps {
  kind: "sale" | "purchase";
  getParties: () => Party[];
  getProducts: () => Product[];
  getWarehouses: () => Warehouse[];
}

export function RecurringModule({ kind, getParties, getProducts, getWarehouses }: RecurringPageProps) {
  const items = useRecurringStore((s) => s.items);
  const add = useRecurringStore((s) => s.add);
  const update = useRecurringStore((s) => s.update);
  const remove = useRecurringStore((s) => s.remove);
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const actorName = useAuthStore((s) => s.currentUser?.name) ?? "—";

  const { t } = useT();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [running, setRunning] = useState(false);
  const canCreate = usePermission("recurring.create");
  const canUpdate = usePermission("recurring.update");
  const canDelete = usePermission("recurring.delete");
  const loading = useSimulatedLoading(600, [search]);

  const list = useMemo(() => items.filter((r) => r.kind === kind), [items, kind]);
  const partyMap = useMemo(() => new Map(getParties().map((p) => [p.id, p])), [getParties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const party = partyMap.get(item.partyId);
      return [item.number, party?.name ?? "", item.frequency, item.status].join(" ").toLowerCase().includes(q);
    });
  }, [list, search, partyMap]);

  const activeCount = list.filter((r) => r.status === "active").length;
  const nextDue = list
    .filter((r) => r.status === "active")
    .sort((a, b) => new Date(a.nextRunDate).getTime() - new Date(b.nextRunDate).getTime())[0];

  const runDue = async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await recurringApi().run(kind);
      toast.success(
        t("${count} invoice(s) generated", "تم إنشاء ${count} فاتورة").replace("${count}", String(result.generated)),
      );
      addNotification({
        kind: "success",
        title: t("Recurring invoices generated", "تم إنشاء الفواتير الدورية"),
        message: t(
          "${actor} ran recurring invoices — ${count} generated.",
          "${actor} شغّل الفواتير الدورية — تم إنشاء ${count} فاتورة.",
        )
          .replace("${actor}", actorName)
          .replace("${count}", String(result.generated)),
      });
      void hydrateParties();
      void hydrateInvoices();
      const refreshed = await recurringApi().list(kind);
      useRecurringStore.getState().hydrate(
        kind === "sale"
          ? [...refreshed, ...useRecurringStore.getState().items.filter((r) => r.kind !== "sale")]
          : [...useRecurringStore.getState().items.filter((r) => r.kind !== "purchase"), ...refreshed],
      );
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setRunning(false);
    }
  };

  const handleToggle = async (recurring: RecurringInvoice) => {
    try {
      const updated = await recurringApi().update(kind, recurring.id, {
        isActive: recurring.status !== "active",
      });
      update(updated.id, updated);
      toast.success(
        t("${number} is now ${state}", "${number} أصبحت ${state}")
          .replace("${number}", recurring.number)
          .replace("${state}", t(updated.status === "active" ? "active" : "inactive", updated.status === "active" ? "نشطة" : "موقوفة")),
      );
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const handleDelete = async (recurring: RecurringInvoice) => {
    try {
      await recurringApi().remove(kind, recurring.id);
      remove(recurring.id);
      toast.success(t("${number} deleted", "تم حذف ${number}").replace("${number}", recurring.number));
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const handleSave = (recurring: RecurringInvoice) => {
    if (editing) update(editing.id, recurring);
    else add(recurring);
    addNotification({
      kind: "success",
      title: t("Recurring invoice recorded", "تم تسجيل الفاتورة الدورية"),
      message: t(
        "${actor} recorded ${number} (${amount}).",
        "${actor} سجّل ${number} (${amount}).",
      )
        .replace("${actor}", actorName)
        .replace("${number}", recurring.number)
        .replace("${amount}", formatCurrency(recurring.total)),
    });
  };

  const columns = useMemo<ColumnDef<RecurringInvoice, any>[]>(
    () =>
      buildColumns({
        t,
        kind,
        partyMap,
        canUpdate,
        canDelete,
        onEdit: setEditing,
        onToggle: handleToggle,
        onDelete: handleDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, partyMap, canUpdate, canDelete],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Recurring Invoices", "الفواتير الدورية")}
        description={t(
          "Automatically issue invoices on a fixed schedule.",
          "أصدر الفواتير تلقائياً وفقاً لجدول ثابت.",
        )}
      >
        <div className="flex gap-2">
          {canUpdate ? (
            <Button variant="outline" onClick={() => void runDue()} disabled={running}>
              <Play className="size-4" />
              {running ? t("Running…", "جارٍ التشغيل…") : t("Run due", "تشغيل المستحقة")}
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New {t("recurring", "فاتورة دورية")}
            </Button>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label={t("Active schedules", "الجدول الزمني النشط")}
          value={String(activeCount)}
          sub={`${list.length} ${t("total schedules", "إجمالي الجداول")}`}
        />
        <SummaryCard
          label={t("Next due date", "الموعد القادم")}
          value={nextDue ? formatDate(nextDue.nextRunDate) : "—"}
          sub={nextDue ? nextDue.number : t("No active schedules", "لا توجد جداول نشطة")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search recurring invoices…", "البحث في الفواتير الدورية…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("records", "سجلات")}</div>
              </div>
            }
            emptyTitle={t("No recurring invoices yet", "لا توجد فواتير دورية بعد")}
            emptyDescription={t("Create your first schedule to get started.", "أنشئ أول جدول زمني لبدء العمل.")}
          />
        )}
      </div>

      <RecurringFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        kind={kind}
        recurring={editing}
        parties={getParties()}
        products={getProducts()}
        warehouses={getWarehouses()}
        onSave={handleSave}
      />
    </div>
  );
}

function buildColumns({
  t,
  kind,
  partyMap,
  canUpdate,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
}: {
  t: TranslateFn;
  kind: "sale" | "purchase";
  partyMap: Map<string, Party>;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (r: RecurringInvoice) => void;
  onToggle: (r: RecurringInvoice) => void;
  onDelete: (r: RecurringInvoice) => void;
}): ColumnDef<RecurringInvoice, any>[] {
  return [
    columnHelper.accessor("number", {
      header: t("Number", "الرقم"),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <span className="font-medium">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "party",
      header: t(kind === "sale" ? "Customer" : "Supplier", kind === "sale" ? "العميل" : "المورد"),
      cell: (info) => partyMap.get(info.row.original.partyId)?.name ?? "—",
    }),
    columnHelper.accessor("frequency", {
      header: t("Frequency", "التكرار"),
      cell: (info) => {
        const r = info.row.original;
        const label = frequencyLabel(info.getValue());
        return `${t(label.en, label.ar)}${r.interval > 1 ? ` ×${r.interval}` : ""}`;
      },
    }),
    columnHelper.accessor("nextRunDate", {
      header: t("Next run", "التشغيل القادم"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("total", {
      header: t("Amount", "المبلغ"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("status", {
      header: t("Status", "الحالة"),
      cell: (info) => (
        <Badge variant={info.getValue() === "active" ? "success" : "muted"} dot className="capitalize">
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const recurring = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate ? (
                <DropdownMenuItem onClick={() => onToggle(recurring)}>
                  {recurring.status === "active"
                    ? t("Pause schedule", "إيقاف الجدول مؤقتاً")
                    : t("Activate schedule", "تفعيل الجدول")}
                </DropdownMenuItem>
              ) : null}
              {canUpdate ? (
                <DropdownMenuItem onClick={() => onEdit(recurring)}>
                  <Pencil className="size-4" /> {t("Edit", "تعديل")}
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(recurring)}>
                  <Trash2 className="size-4" /> {t("Delete", "حذف")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
