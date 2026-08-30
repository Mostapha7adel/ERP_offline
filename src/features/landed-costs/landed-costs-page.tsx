import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, Pencil, Truck, X,
} from "lucide-react";
import { useLandedCostsStore } from "@/stores/landed-costs-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { landedCostsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { LandedCost, LandedCostLine } from "@/types/domain";
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

const columnHelper = createColumnHelper<LandedCost>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildColumns(h: {
  onEdit: (lc: LandedCost) => void;
  onRemove: (lc: LandedCost) => void;
  canManage: boolean;
  t: TranslateFn;
}): ColumnDef<LandedCost, any>[] {
  return [
    columnHelper.accessor("purchaseInvoiceNumber", {
      header: h.t("Purchase Invoice", "فاتورة الشراء"),
      cell: (info) => {
        const lc = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? lc.purchaseInvoiceId}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("totalAmount", {
      header: h.t("Total Amount", "المبلغ الإجمالي"),
      cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
    }),
    columnHelper.accessor("allocationMethod", {
      header: h.t("Allocation", "التخصيص"),
      cell: (info) => {
        const method = info.getValue();
        return (
          <Badge variant="outline">
            {method === "value" ? h.t("By Value", "حسب القيمة")
              : method === "quantity" ? h.t("By Quantity", "حسب الكمية")
              : h.t("By Weight", "حسب الوزن")}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("lines", {
      header: h.t("Items", "العناصر"),
      cell: (info) => `${info.getValue().length} ${h.t("items", "عنصر")}`,
    }),
    columnHelper.accessor("createdAt", {
      header: h.t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const lc = info.row.original;
        return h.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onEdit(lc)}>
                <Pencil className="size-4" /> {h.t("Edit", "تعديل")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => h.onRemove(lc)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null;
      },
    }),
  ];
}

export function LandedCostsPage() {
  const items = useLandedCostsStore((s) => s.items);
  const add = useLandedCostsStore((s) => s.add);
  const update = useLandedCostsStore((s) => s.update);
  const remove = useLandedCostsStore((s) => s.remove);
  const invoices = useInvoicesStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LandedCost | null>(null);
  const [deleting, setDeleting] = useState<LandedCost | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("landed-costs.create");
  const canManage = usePermission("landed-costs.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const purchaseInvoices = useMemo(
    () => invoices.filter((inv) => inv.kind === "purchase" && inv.status !== "cancelled"),
    [invoices],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((lc) =>
      [lc.purchaseInvoiceNumber ?? "", lc.purchaseInvoiceId, lc.allocationMethod]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  const handleSave = (lc: LandedCost) => {
    if (items.some((x) => x.id === lc.id)) update(lc.id, lc);
    else add(lc);
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await landedCostsApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Landed cost deleted", "تم حذف تكلفة الشحن"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<LandedCost, any>[]>(
    () =>
      buildColumns({
        onEdit: setEditing,
        onRemove: (lc) => { setDeleting(lc); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Landed Costs", "تكاليف الشحن")}
        description={t("Allocate additional costs to purchase invoices.", "توزيع التكاليف الإضافية على فواتير الشراء.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Add landed cost", "إضافة تكلفة شحن")}
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
                  placeholder={t("Search landed costs…", "ابحث عن تكاليف الشحن…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("entries", "سجل")}</div>
              </div>
            }
            emptyTitle={t("No landed costs", "لا توجد تكاليف شحن")}
            emptyDescription={t("Add landed costs to allocate shipping and handling charges to purchases.", "أضف تكاليف الشحن لتوزيع رسوم الشحن والمناولة على المشتريات.")}
          />
        )}
      </div>

      <LandedCostFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        landedCost={editing}
        purchaseInvoices={purchaseInvoices.map((inv) => ({ id: inv.id, number: inv.number }))}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete landed cost?", "حذف تكلفة الشحن؟")}
        description={t("This will permanently remove this landed cost entry.", "سيؤدي هذا إلى حذف هذا السجل نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function LandedCostFormDialog({
  open,
  onOpenChange,
  landedCost,
  purchaseInvoices,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landedCost: LandedCost | null;
  purchaseInvoices: Array<{ id: string; number: string }>;
  onSave: (lc: LandedCost) => void;
}) {
  const { t } = useT();
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(landedCost?.purchaseInvoiceId ?? "");
  const [totalAmount, setTotalAmount] = useState(landedCost?.totalAmount ?? 0);
  const [allocationMethod, setAllocationMethod] = useState<"value" | "quantity" | "weight">(landedCost?.allocationMethod ?? "value");
  const [lines, setLines] = useState<LandedCostLine[]>(landedCost?.lines ?? []);
  const [lineDesc, setLineDesc] = useState("");
  const [lineAmt, setLineAmt] = useState(0);
  const [notes, setNotes] = useState(landedCost?.notes ?? "");

  const isEdit = Boolean(landedCost);

  const addLine = () => {
    if (!lineDesc || lineAmt <= 0) return;
    setLines((prev) => [...prev, { id: `line-${Date.now()}`, description: lineDesc, amount: lineAmt }]);
    setLineDesc("");
    setLineAmt(0);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = () => {
    const inv = purchaseInvoices.find((i) => i.id === purchaseInvoiceId);
    const record: LandedCost = {
      id: landedCost?.id ?? `lc-${Date.now()}`,
      purchaseInvoiceId,
      purchaseInvoiceNumber: inv?.number,
      totalAmount,
      allocationMethod,
      lines,
      notes,
      createdAt: landedCost?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(record);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Edit Landed Cost", "تعديل تكلفة الشحن") : t("New Landed Cost", "تكلفة شحن جديدة")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>{t("Purchase Invoice", "فاتورة الشراء")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={purchaseInvoiceId}
              onChange={(e) => setPurchaseInvoiceId(e.target.value)}
            >
              <option value="">{t("Select invoice…", "اختر فاتورة…")}</option>
              {purchaseInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.number}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Total Amount", "المبلغ الإجمالي")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={totalAmount || ""}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Allocation Method", "طريقة التخصيص")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={allocationMethod}
                onChange={(e) => setAllocationMethod(e.target.value as "value" | "quantity" | "weight")}
              >
                <option value="value">{t("By Value", "حسب القيمة")}</option>
                <option value="quantity">{t("By Quantity", "حسب الكمية")}</option>
                <option value="weight">{t("By Weight", "حسب الوزن")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("Cost Lines", "بنود التكلفة")}</Label>
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{line.description}</span>
                <span className="tabular-nums text-sm">{money(line.amount)}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => removeLine(line.id)}>
                  <X className="size-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={lineDesc}
                onChange={(e) => setLineDesc(e.target.value)}
                placeholder={t("Description", "الوصف")}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={lineAmt || ""}
                onChange={(e) => setLineAmt(Number(e.target.value))}
                placeholder={t("Amount", "المبلغ")}
                className="w-28"
              />
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="size-3" />
              </Button>
            </div>
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
          <Button onClick={handleSave} disabled={!purchaseInvoiceId || totalAmount <= 0}>
            {isEdit ? t("Save", "حفظ") : t("Create", "إنشاء")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
