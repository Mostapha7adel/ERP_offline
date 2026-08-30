import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { usePaymentVouchersStore } from "@/stores/payment-vouchers-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { formatDate, formatCurrency } from "@/lib/format";
import { paymentVouchersApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { PaymentVoucher } from "@/types/domain";
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

const columnHelper = createColumnHelper<PaymentVoucher>();

interface Handlers {
  onEdit: (v: PaymentVoucher) => void;
  onRemove: (v: PaymentVoucher) => void;
  canManage: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<PaymentVoucher, any>[] {
  return [
    columnHelper.accessor("number", {
      header: h.t("Number", "الرقم"),
      cell: (info) => {
        const v = info.row.original;
        const Icon = v.type === "receipt" ? ArrowDownLeft : ArrowUpRight;
        return (
          <div className="flex items-center gap-3">
            <div className={`flex size-8 items-center justify-center rounded-lg ${v.type === "receipt" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <Icon className="size-4" />
            </div>
            <div>
              <p className="font-medium font-mono text-xs">{v.number}</p>
              <p className="text-xs text-muted-foreground">{v.type === "receipt" ? h.t("Receipt", "قبض") : h.t("Payment", "صرف")}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("partyName", {
      header: h.t("Party", "الطرف"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("amount", {
      header: h.t("Amount", "المبلغ"),
      cell: (info) => {
        const v = info.row.original;
        const tone = v.type === "receipt" ? "text-success" : "text-destructive";
        const sign = v.type === "receipt" ? "+" : "-";
        return <span className={`tabular-nums font-medium ${tone}`}>{sign}{formatCurrency(v.amount)}</span>;
      },
    }),
    columnHelper.accessor("paymentMethod", {
      header: h.t("Method", "الطريقة"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("date", {
      header: h.t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const variant = status === "approved" ? "success" : status === "cancelled" ? "destructive" : "warning";
        return (
          <Badge variant={variant} dot className="capitalize">
            {status === "approved" ? h.t("Approved", "معتمد") : status === "cancelled" ? h.t("Cancelled", "ملغى") : h.t("Draft", "مسودة")}
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

export function PaymentVouchersPage() {
  const items = usePaymentVouchersStore((s) => s.items);
  const add = usePaymentVouchersStore((s) => s.add);
  const update = usePaymentVouchersStore((s) => s.update);
  const remove = usePaymentVouchersStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentVoucher | null>(null);
  const [deleting, setDeleting] = useState<PaymentVoucher | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [formType, setFormType] = useState<"receipt" | "payment">("receipt");
  const [formParty, setFormParty] = useState("");
  const [formAmount, setFormAmount] = useState(0);
  const [formMethod, setFormMethod] = useState("cash");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<"draft" | "approved" | "cancelled">("draft");

  const canCreate = usePermission("treasury.create");
  const canManage = usePermission("treasury.create");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((v) =>
      [v.number, v.partyName ?? "", v.paymentMethod, v.description ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    const receipts = items.filter((v) => v.type === "receipt" && v.status !== "cancelled").reduce((s, v) => s + v.amount, 0);
    const payments = items.filter((v) => v.type === "payment" && v.status !== "cancelled").reduce((s, v) => s + v.amount, 0);
    return { receipts, payments, net: receipts - payments };
  }, [items]);

  const resetForm = () => {
    setFormType("receipt");
    setFormParty("");
    setFormAmount(0);
    setFormMethod("cash");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDesc("");
    setFormStatus("draft");
  };

  const openCreate = (type: "receipt" | "payment") => {
    resetForm();
    setFormType(type);
    setCreateOpen(true);
  };

  const openEdit = (v: PaymentVoucher) => {
    setFormType(v.type);
    setFormParty(v.partyName ?? "");
    setFormAmount(v.amount);
    setFormMethod(v.paymentMethod);
    setFormDate(v.date.slice(0, 10));
    setFormDesc(v.description ?? "");
    setFormStatus(v.status);
    setEditing(v);
  };

  const handleSave = async () => {
    const input = {
      type: formType,
      date: formDate,
      accountId: "",
      amount: formAmount,
      paymentMethod: formMethod,
      description: formDesc,
      status: formStatus,
    };

    if (editing) {
      try {
        const updated = await paymentVouchersApi().update(editing.id, input);
        update(updated.id, updated);
        toast.success(t("Voucher updated", "تم تحديث السند"));
      } catch {
        toast.error(t("Update failed", "فشل التحديث"));
      }
    } else {
      try {
        const created = await paymentVouchersApi().create(input);
        add(created);
        toast.success(t("Voucher created", "تم إنشاء السند"));
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
        await paymentVouchersApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Voucher deleted", "تم حذف السند"));
      } catch {
        toast.error(t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<PaymentVoucher, any>[]>(
    () =>
      buildColumns({
        onEdit: openEdit,
        onRemove: (v) => { setDeleting(v); setConfirmOpen(true); },
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  const dialogTitle = editing ? t("Edit voucher", "تعديل السند") : t("New voucher", "سند جديد");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Payment Vouchers", "سندات القبض والصرف")}
        description={t("Record receipt and payment vouchers.", "سجّل سندات القبض والصرف.")}
      >
        {canCreate ? (
          <div className="flex gap-2">
            <Button onClick={() => openCreate("receipt")} variant="outline">
              <ArrowDownLeft className="size-4" />
              {t("Receipt voucher", "سند قبض")}
            </Button>
            <Button onClick={() => openCreate("payment")}>
              <ArrowUpRight className="size-4" />
              {t("Payment voucher", "سند صرف")}
            </Button>
          </div>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total receipts", "إجمالي القبضات")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{formatCurrency(totals.receipts)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total payments", "إجمالي الصرفات")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{formatCurrency(totals.payments)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Net", "الصافي")}</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${totals.net >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(totals.net)}</p>
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
                  placeholder={t("Search vouchers…", "ابحث عن السندات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("vouchers", "سند")}</div>
              </div>
            }
            emptyTitle={t("No vouchers yet", "لا توجد سندات بعد")}
            emptyDescription={t("Create a receipt or payment voucher to get started.", "أنشئ سند قبض أو صرف للبدء.")}
          />
        )}
      </div>

      <Dialog open={createOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {formType === "receipt"
                ? t("Record a receipt from a customer.", "تسجيل قبض من عميل.")
                : t("Record a payment to a supplier.", "تسجيل صرف لمورد.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={formType === "receipt" ? "default" : "outline"}
                onClick={() => setFormType("receipt")}
              >
                <ArrowDownLeft className="size-4" /> {t("Receipt", "قبض")}
              </Button>
              <Button
                type="button"
                variant={formType === "payment" ? "default" : "outline"}
                onClick={() => setFormType("payment")}
              >
                <ArrowUpRight className="size-4" /> {t("Payment", "صرف")}
              </Button>
            </div>
            <Input
              placeholder={t("Party name", "اسم الطرف")}
              value={formParty}
              onChange={(e) => setFormParty(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={t("Amount", "المبلغ")}
              value={formAmount || ""}
              onChange={(e) => setFormAmount(Number(e.target.value))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={t("Payment method", "طريقة الدفع")}
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
              />
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <Input
              placeholder={t("Description", "الوصف")}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditing(null); resetForm(); }}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={handleSave} disabled={formAmount <= 0}>
              {editing ? t("Save", "حفظ") : t("Create", "إنشاء")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete voucher?", "حذف السند؟")}
        description={t("This will permanently remove the voucher.", "سيؤدي هذا إلى حذف السند نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
