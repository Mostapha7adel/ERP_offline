import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, HandCoins, Wallet,
} from "lucide-react";
import { useAdvancesStore } from "@/stores/advances-store";
import { useCustomersStore } from "@/stores/parties-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useCurrenciesStore } from "@/stores/currencies-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { advancesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { CustomerAdvance } from "@/types/domain";
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
import { Combobox } from "@/shared/components/forms/combobox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { AdvanceFormDialog } from "./advance-form-dialog";

const columnHelper = createColumnHelper<CustomerAdvance>();

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

interface Handlers {
  onEdit: (a: CustomerAdvance) => void;
  onAllocate: (a: CustomerAdvance) => void;
  onRemove: (a: CustomerAdvance) => void;
  canManage: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<CustomerAdvance, any>[] {
  return [
    columnHelper.accessor("partyName", {
      header: h.t("Customer", "العميل"),
      cell: (info) => {
        const a = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? a.partyId}</p>
              <p className="text-xs text-muted-foreground">{a.reference ?? "—"}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("amount", {
      header: h.t("Amount", "المبلغ"),
      cell: (info) => {
        const a = info.row.original;
        return <span className="tabular-nums font-medium">{money(a.amount, a.currency)}</span>;
      },
    }),
    columnHelper.accessor("balance", {
      header: h.t("Balance", "الرصيد"),
      cell: (info) => {
        const a = info.row.original;
        return (
          <Badge variant={a.balance > 0 ? "warning" : "success"} dot>
            <span className="tabular-nums">{money(a.balance, a.currency)}</span>
          </Badge>
        );
      },
    }),
    columnHelper.accessor("date", {
      header: h.t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("method", {
      header: h.t("Method", "الطريقة"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.display({
      id: "allocations",
      header: h.t("Allocated", "المخصص"),
      cell: (info) => {
        const a = info.row.original;
        const alloc = a.allocations ?? [];
        return alloc.length > 0 ? alloc.length : h.t("None", "لا شيء");
      },
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
              {a.balance > 0 && h.canManage ? (
                <DropdownMenuItem onClick={() => h.onAllocate(a)}>
                  <HandCoins className="size-4" /> {h.t("Allocate to invoice", "تخصيص لفاتورة")}
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

export function AdvancesPage() {
  const items = useAdvancesStore((s) => s.items);
  const add = useAdvancesStore((s) => s.add);
  const update = useAdvancesStore((s) => s.update);
  const remove = useAdvancesStore((s) => s.remove);
  const customers = useCustomersStore((s) => s.items);
  const invoices = useInvoicesStore((s) => s.items);
  const currencies = useCurrenciesStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerAdvance | null>(null);
  const [allocating, setAllocating] = useState<CustomerAdvance | null>(null);
  const [allocInvoiceId, setAllocInvoiceId] = useState("");
  const [allocAmount, setAllocAmount] = useState(0);
  const [allocBusy, setAllocBusy] = useState(false);
  const [deleting, setDeleting] = useState<CustomerAdvance | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("advances.create");
  const canManage = usePermission("advances.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      [a.partyName ?? "", a.reference ?? "", a.currency].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const openAllocate = (a: CustomerAdvance) => {
    setAllocating(a);
    setAllocInvoiceId("");
    setAllocAmount(0);
  };

  const openInvoices = useMemo(() => {
    if (!allocating) return [];
    return invoices.filter(
      (inv) =>
        inv.kind === "sale" &&
        inv.partyId === allocating.partyId &&
        inv.status !== "cancelled" &&
        inv.total - inv.paid > 0,
    );
  }, [invoices, allocating]);

  const invoiceOptions = useMemo(
    () =>
      openInvoices.map((inv) => ({
        value: inv.id,
        label: `${inv.number} — ${money(inv.total - inv.paid, inv.currency)}`,
      })),
    [openInvoices],
  );

  const confirmAllocate = async () => {
    if (!allocating || !allocInvoiceId) return;
    setAllocBusy(true);
    try {
      const updated = await advancesApi().allocate(allocating.id, allocInvoiceId, allocAmount);
      update(updated.id, updated);
      toast.success(t("Advance allocated", "تم تخصيص السلفة"));
      setAllocating(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Allocation failed", "فشل التخصيص"));
    } finally {
      setAllocBusy(false);
    }
  };

  const handleSave = (advance: CustomerAdvance) => {
    if (items.some((a) => a.id === advance.id)) update(advance.id, advance);
    else add(advance);
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await advancesApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Advance deleted", "تم حذف السلفة"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<CustomerAdvance, any>[]>(
    () =>
      buildColumns({
        onEdit: setEditing,
        onAllocate: openAllocate,
        onRemove: (a) => { setDeleting(a); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Customer Advances", "سلف العملاء")}
        description={t("Record advance payments and allocate them to invoices.", "سجّل الدفعات المقدمة وخصصها للفواتير.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Record advance", "تسجيل سلفة")}
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
                  placeholder={t("Search advances…", "ابحث عن السلف…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("advances", "سلفة")}</div>
              </div>
            }
            emptyTitle={t("No advances yet", "لا توجد سلف بعد")}
            emptyDescription={t("Record a customer advance to track balances and allocations.", "سجّل سلفة عميل لتتبع الأرصدة والتخصيصات.")}
          />
        )}
      </div>

      <AdvanceFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        advance={editing}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        currencies={currencies.length > 0 ? currencies.map((c) => ({ code: c.code, name: c.name })) : [{ code: "EGP", name: "Egyptian Pound" }, { code: "USD", name: "US Dollar" }]}
        onSave={handleSave}
      />

      <Dialog open={Boolean(allocating)} onOpenChange={(open) => { if (!open) setAllocating(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Allocate advance", "تخصيص سلفة")}</DialogTitle>
            <DialogDescription>
              {allocating
                ? `${t("Available balance", "الرصيد المتاح")}: ${money(allocating.balance, allocating.currency)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Combobox
              options={invoiceOptions}
              value={allocInvoiceId}
              onValueChange={setAllocInvoiceId}
              placeholder={t("Select an open invoice…", "اختر فاتورة مفتوحة…")}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              max={allocating?.balance ?? 0}
              placeholder={t("Allocation amount", "مبلغ التخصيص")}
              value={allocAmount || ""}
              onChange={(e) => setAllocAmount(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAllocating(null)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={confirmAllocate} loading={allocBusy} disabled={!allocInvoiceId || allocAmount <= 0}>
              <HandCoins className="size-4" />
              {t("Allocate", "تخصيص")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete advance?", "حذف السلفة؟")}
        description={t("This will permanently remove the advance and its allocations.", "سيؤدي هذا إلى حذف السلفة وتخصيصاتها نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}