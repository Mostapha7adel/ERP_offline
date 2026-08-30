import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, Pencil, CreditCard, Eye, EyeOff,
} from "lucide-react";
import { usePaymentGatewaysStore } from "@/stores/payment-gateways-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { paymentGatewaysApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { PaymentGatewayConfig, PaymentGatewayTransaction } from "@/types/domain";
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

const columnHelper = createColumnHelper<PaymentGatewayConfig>();

const GATEWAY_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  stripe: { en: "Stripe", ar: "سترايب" },
  paypal: { en: "PayPal", ar: "باي بال" },
  square: { en: "Square", ar: "سكوير" },
  paymob: { en: "Paymob", ar: "بايموب" },
  other: { en: "Other", ar: "أخرى" },
};

const TX_STATUS_LABELS: Record<string, { en: string; ar: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { en: "Pending", ar: "قيد الانتظار", variant: "outline" },
  completed: { en: "Completed", ar: "مكتمل", variant: "default" },
  failed: { en: "Failed", ar: "فشل", variant: "destructive" },
  refunded: { en: "Refunded", ar: "مسترد", variant: "secondary" },
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildConfigColumns(h: {
  onEdit: (c: PaymentGatewayConfig) => void;
  onRemove: (c: PaymentGatewayConfig) => void;
  onToggle: (c: PaymentGatewayConfig) => void;
  onViewTx: (c: PaymentGatewayConfig) => void;
  canManage: boolean;
  t: TranslateFn;
}): ColumnDef<PaymentGatewayConfig, any>[] {
  return [
    columnHelper.accessor("name", {
      header: h.t("Name", "الاسم"),
      cell: (info) => {
        const c = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue()}</p>
              <p className="text-xs text-muted-foreground">{GATEWAY_TYPE_LABELS[c.type]?.ar ?? c.type}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("type", {
      header: h.t("Type", "النوع"),
      cell: (info) => <Badge variant="outline">{GATEWAY_TYPE_LABELS[info.getValue()]?.en ?? info.getValue()}</Badge>,
    }),
    columnHelper.accessor("sandboxMode", {
      header: h.t("Mode", "الوضع"),
      cell: (info) => info.getValue()
        ? <Badge variant="outline">{h.t("Sandbox", "تجريبي")}</Badge>
        : <Badge variant="default">{h.t("Live", "حي")}</Badge>,
    }),
    columnHelper.accessor("isActive", {
      header: h.t("Active", "نشط"),
      cell: (info) => (
        <button
          onClick={() => h.onToggle(info.row.original)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${info.getValue() ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${info.getValue() ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const c = info.row.original;
        return h.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onViewTx(c)}>
                <CreditCard className="size-4" /> {h.t("View Transactions", "عرض المعاملات")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => h.onEdit(c)}>
                <Pencil className="size-4" /> {h.t("Edit", "تعديل")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => h.onRemove(c)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null;
      },
    }),
  ];
}

const txColumnHelper = createColumnHelper<PaymentGatewayTransaction>();

function buildTxColumns(t: TranslateFn): ColumnDef<PaymentGatewayTransaction, any>[] {
  return [
    txColumnHelper.accessor("gatewayName", {
      header: t("Gateway", "البوابة"),
      cell: (info) => info.getValue() ?? "—",
    }),
    txColumnHelper.accessor("invoiceNumber", {
      header: t("Invoice", "الفاتورة"),
      cell: (info) => info.getValue() ?? "—",
    }),
    txColumnHelper.accessor("customerName", {
      header: t("Customer", "العميل"),
      cell: (info) => info.getValue() ?? "—",
    }),
    txColumnHelper.accessor("amount", {
      header: t("Amount", "المبلغ"),
      cell: (info) => <span className="tabular-nums font-medium">{money(info.getValue())}</span>,
    }),
    txColumnHelper.accessor("status", {
      header: t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const label = TX_STATUS_LABELS[status] ?? { en: status, ar: status, variant: "outline" as const };
        return <Badge variant={label.variant}>{t(label.en, label.ar)}</Badge>;
      },
    }),
    txColumnHelper.accessor("createdAt", {
      header: t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
  ];
}

export function PaymentGatewaysPage() {
  const items = usePaymentGatewaysStore((s) => s.items);
  const add = usePaymentGatewaysStore((s) => s.add);
  const update = usePaymentGatewaysStore((s) => s.update);
  const remove = usePaymentGatewaysStore((s) => s.remove);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentGatewayConfig | null>(null);
  const [deleting, setDeleting] = useState<PaymentGatewayConfig | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [txData, setTxData] = useState<PaymentGatewayTransaction[]>([]);
  const [busy, setBusy] = useState(false);

  const canCreate = usePermission("payment-gateways.create");
  const canManage = usePermission("payment-gateways.create");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      [c.name, c.type, c.sandboxMode ? "sandbox" : "live"].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const handleSave = async (data: { name: string; type: PaymentGatewayConfig["type"]; apiKey?: string; merchantId?: string; sandboxMode: boolean }) => {
    setBusy(true);
    try {
      if (editing) {
        const updated = await paymentGatewaysApi().updateConfig(editing.id, data);
        update(editing.id, updated);
        toast.success(t("Gateway updated", "تم تحديث البوابة"));
      } else {
        const created = await paymentGatewaysApi().createConfig(data);
        add(created);
        toast.success(t("Gateway created", "تم إنشاء البوابة"));
      }
      setCreateOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (config: PaymentGatewayConfig) => {
    try {
      const updated = await paymentGatewaysApi().updateConfig(config.id, { isActive: !config.isActive } as any);
      update(config.id, updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    }
  };

  const handleViewTransactions = async (config: PaymentGatewayConfig) => {
    try {
      const txs = await paymentGatewaysApi().listTransactions({ gatewayId: config.id });
      setTxData(txs);
      setTxOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    }
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await paymentGatewaysApi().deleteConfig(deleting.id);
        remove(deleting.id);
        toast.success(t("Gateway deleted", "تم حذف البوابة"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<PaymentGatewayConfig, any>[]>(
    () =>
      buildConfigColumns({
        onEdit: setEditing,
        onRemove: (c) => { setDeleting(c); setConfirmOpen(true); },
        onToggle: handleToggle,
        onViewTx: handleViewTransactions,
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, items],
  );

  const txColumns = useMemo(() => buildTxColumns(t), [t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Payment Gateways", "بوابات الدفع")}
        description={t("Configure payment gateways and view transactions.", "تكوين بوابات الدفع وعرض المعاملات.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Add gateway", "إضافة بوابة")}
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
                  placeholder={t("Search gateways…", "ابحث عن بوابات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("gateways", "بوابة")}</div>
              </div>
            }
            emptyTitle={t("No gateways", "لا توجد بوابات")}
            emptyDescription={t("Add a payment gateway to accept online payments.", "أضف بوابة دفع لقبول المدفوعات عبر الإنترنت.")}
          />
        )}
      </div>

      <GatewayFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        gateway={editing}
        onSave={handleSave}
        busy={busy}
      />

      <Dialog open={txOpen} onOpenChange={(open) => { if (!open) setTxOpen(false); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("Transactions", "المعاملات")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <DataTable columns={txColumns} data={txData} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>{t("Close", "إغلاق")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete gateway?", "حذف البوابة؟")}
        description={t("This will permanently remove this gateway configuration.", "سيؤدي هذا إلى حذف تكوين البوابة نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function GatewayFormDialog({
  open,
  onOpenChange,
  gateway,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway: PaymentGatewayConfig | null;
  onSave: (data: { name: string; type: PaymentGatewayConfig["type"]; apiKey?: string; merchantId?: string; sandboxMode: boolean }) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [name, setName] = useState(gateway?.name ?? "");
  const [type, setType] = useState<PaymentGatewayConfig["type"]>(gateway?.type ?? "stripe");
  const [apiKey, setApiKey] = useState(gateway?.apiKey ?? "");
  const [merchantId, setMerchantId] = useState(gateway?.merchantId ?? "");
  const [sandboxMode, setSandboxMode] = useState(gateway?.sandboxMode ?? true);
  const [showKey, setShowKey] = useState(false);

  const isEdit = Boolean(gateway);

  const handleSave = () => {
    onSave({ name, type, apiKey: apiKey || undefined, merchantId: merchantId || undefined, sandboxMode });
    setName("");
    setType("stripe");
    setApiKey("");
    setMerchantId("");
    setSandboxMode(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Edit Gateway", "تعديل البوابة") : t("New Gateway", "بوابة جديدة")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Name", "الاسم")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. My Stripe", "مثال: سترايب الخاص بي")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Type", "النوع")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="square">Square</option>
              <option value="paymob">Paymob</option>
              <option value="other">{t("Other", "أخرى")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("API Key", "مفتاح API")}</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("Enter API key", "أدخل مفتاح API")}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Merchant ID", "رقم التاجر")}</Label>
            <Input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} placeholder={t("Optional", "اختياري")} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSandboxMode(!sandboxMode)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sandboxMode ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${sandboxMode ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <Label>{t("Sandbox Mode", "وضع تجريبي")}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} loading={busy} disabled={!name}>
            {isEdit ? t("Save", "حفظ") : t("Create", "إنشاء")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
