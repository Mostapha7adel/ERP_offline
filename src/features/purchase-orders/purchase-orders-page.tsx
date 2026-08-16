import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Check, PackageCheck, X, Send,
} from "lucide-react";
import { usePurchaseOrdersStore } from "@/stores/purchase-orders-store";
import { useSuppliersStore } from "@/stores/parties-store";
import { useWarehousesStore } from "@/stores/inventory-store";
import { useProductsStore } from "@/stores/products-store";
import { useCurrenciesStore } from "@/stores/currencies-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { purchaseOrdersApi, invoicesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/domain";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { PurchaseOrderFormDialog } from "./purchase-order-form-dialog";

const columnHelper = createColumnHelper<PurchaseOrder>();

const STATUS_STYLES: Record<PurchaseOrderStatus, "default" | "muted" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "muted",
  pending: "warning",
  approved: "default",
  partially_received: "outline",
  received: "success",
  cancelled: "destructive",
};

function statusLabel(s: PurchaseOrderStatus, t: TranslateFn): string {
  switch (s) {
    case "draft": return t("Draft", "مسودة");
    case "pending": return t("Pending approval", "بانتظار الاعتماد");
    case "approved": return t("Approved", "معتمد");
    case "partially_received": return t("Partially received", "استلام جزئي");
    case "received": return t("Received", "مستلم");
    case "cancelled": return t("Cancelled", "ملغي");
  }
}

interface Handlers {
  onEdit: (po: PurchaseOrder) => void;
  onReceive: (po: PurchaseOrder) => void;
  onSubmit: (po: PurchaseOrder) => void;
  onApprove: (po: PurchaseOrder) => void;
  onCancel: (po: PurchaseOrder) => void;
  onRemove: (po: PurchaseOrder) => void;
  canApprove: boolean;
  canReceive: boolean;
  canManage: boolean;
  canEdit: boolean;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<PurchaseOrder, any>[] {
  return [
    columnHelper.accessor("number", {
      header: h.t("Number", "الرقم"),
      cell: (info) => {
        const po = info.row.original;
        return (
          <div>
            <p className="font-medium">{po.number}</p>
            <p className="text-xs text-muted-foreground">{h.t("Ordered", "مطلوب")}: {po.orderedQty ?? po.lines.reduce((s, l) => s + l.quantity, 0)}</p>
          </div>
        );
      },
    }),
    columnHelper.accessor("supplierName", {
      header: h.t("Supplier", "المورد"),
      cell: (info) => info.getValue() ?? h.t("Unassigned", "غير معيّن"),
    }),
    columnHelper.accessor("orderDate", {
      header: h.t("Order date", "تاريخ الأمر"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("total", {
      header: h.t("Total", "الإجمالي"),
      cell: (info) => {
        const po = info.row.original;
        return (
          <span className="font-medium tabular-nums">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: po.currency, maximumFractionDigits: 2 }).format(po.total)}
          </span>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const s = info.getValue() as PurchaseOrderStatus;
        return (
          <Badge variant={STATUS_STYLES[s]} dot>
            {statusLabel(s, h.t)}
          </Badge>
        );
      },
    }),
    columnHelper.display({
      id: "received",
      header: h.t("Received", "المستلم"),
      cell: (info) => {
        const po = info.row.original;
        const ordered = po.orderedQty ?? po.lines.reduce((s, l) => s + l.quantity, 0);
        const received = po.receivedQty ?? po.lines.reduce((s, l) => s + l.receivedQty, 0);
        return (
          <span className="tabular-nums text-sm">
            {received} / {ordered}
          </span>
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
      cell: (info) => {
        const po = info.row.original;
        const status = po.status;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {h.canEdit && (status === "draft" || status === "pending") ? (
                <DropdownMenuItem onClick={() => h.onEdit(po)}>
                  <Plus className="size-4" /> {h.t("Edit", "تعديل")}
                </DropdownMenuItem>
              ) : null}
              {status === "draft" && h.canEdit ? (
                <DropdownMenuItem onClick={() => h.onSubmit(po)}>
                  <Send className="size-4" /> {h.t("Submit for approval", "إرسال للاعتماد")}
                </DropdownMenuItem>
              ) : null}
              {status === "pending" && h.canApprove ? (
                <DropdownMenuItem onClick={() => h.onApprove(po)}>
                  <Check className="size-4" /> {h.t("Approve", "اعتماد")}
                </DropdownMenuItem>
              ) : null}
              {(status === "approved" || status === "partially_received") && h.canReceive ? (
                <DropdownMenuItem onClick={() => h.onReceive(po)}>
                  <PackageCheck className="size-4" /> {h.t("Receive goods", "استلام البضاعة")}
                </DropdownMenuItem>
              ) : null}
              {(status === "draft" || status === "pending" || status === "approved") && h.canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onCancel(po)} className="text-warning focus:text-warning">
                    <X className="size-4" /> {h.t("Cancel order", "إلغاء الأمر")}
                  </DropdownMenuItem>
                </>
              ) : null}
              {status === "draft" && h.canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onRemove(po)} className="text-destructive focus:text-destructive">
                    <X className="size-4" /> {h.t("Delete", "حذف")}
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

export function PurchaseOrdersPage() {
  const items = usePurchaseOrdersStore((s) => s.items);
  const add = usePurchaseOrdersStore((s) => s.add);
  const update = usePurchaseOrdersStore((s) => s.update);
  const remove = usePurchaseOrdersStore((s) => s.remove);
  const suppliers = useSuppliersStore((s) => s.items);
  const warehouses = useWarehousesStore((s) => s.items);
  const products = useProductsStore((s) => s.items);
  const currencies = useCurrenciesStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [receivingBusy, setReceivingBusy] = useState(false);

  const canCreate = usePermission("purchase-orders.create");
  const canEdit = usePermission("purchase-orders.update");
  const canApprove = usePermission("purchase-orders.approve");
  const canReceive = usePermission("purchase-orders.receive");
  const canManage = usePermission("purchase-orders.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((po) =>
      [po.number, po.supplierName ?? "", po.status].join(" ").toLowerCase().includes(q),
    );
  }, [items, search]);

  const handleSave = (order: PurchaseOrder) => {
    if (items.some((po) => po.id === order.id)) update(order.id, order);
    else add(order);
  };

  const runAction = async (fn: () => Promise<PurchaseOrder>, okMsg: string) => {
    try {
      const updated = await fn();
      update(updated.id, updated);
      toast.success(okMsg);
      return updated;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Action failed", "فشلت العملية"));
      return null;
    }
  };

  const onSubmit = (po: PurchaseOrder) =>
    runAction(() => purchaseOrdersApi().submit(po.id), t("Submitted for approval", "تم الإرسال للاعتماد"));
  const onApprove = (po: PurchaseOrder) =>
    runAction(() => purchaseOrdersApi().approve(po.id), t("Purchase order approved", "تم اعتماد أمر الشراء"));
  const onCancel = (po: PurchaseOrder) =>
    runAction(() => purchaseOrdersApi().cancel(po.id), t("Purchase order cancelled", "تم إلغاء أمر الشراء"));

  const openReceive = (po: PurchaseOrder) => {
    setReceiving(po);
    setReceiveQty(
      Object.fromEntries(po.lines.map((l) => [l.id, Math.max(0, l.quantity - l.receivedQty)])),
    );
  };

  const confirmReceive = async () => {
    if (!receiving) return;
    setReceivingBusy(true);
    try {
      const quantities = Object.fromEntries(
        Object.entries(receiveQty).filter(([, v]) => v > 0),
      );
      const result = await purchaseOrdersApi().receive(receiving.id, quantities);
      update(result.id, result);
      if (result.invoiceId) {
        // Re-pull invoices so the created purchase invoice appears immediately.
        const [sales, purchases] = await Promise.all([
          invoicesApi().list("sale"),
          invoicesApi().list("purchase"),
        ]);
        // Store hydration happens on next load; inject into invoice store if available.
        const { useInvoicesStore } = await import("@/stores/invoices-store");
        useInvoicesStore.getState().hydrate([...sales, ...purchases]);
      }
      toast.success(t("Goods received", "تم استلام البضاعة"));
      setReceiving(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Receive failed", "فشل الاستلام"));
    } finally {
      setReceivingBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await purchaseOrdersApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("Purchase order deleted", "تم حذف أمر الشراء"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<PurchaseOrder, any>[]>(
    () =>
      buildColumns({
        onEdit: setEditing,
        onReceive: openReceive,
        onSubmit,
        onApprove,
        onCancel,
        onRemove: (po) => { setDeleting(po); setConfirmOpen(true); },
        canApprove,
        canReceive,
        canManage,
        canEdit,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canApprove, canReceive, canManage, canEdit, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Purchase Orders", "أوامر الشراء")}
        description={t("Create, approve and receive purchase orders.", "أنشئ أوامر الشراء واعتمدها واستلم بضاعتها.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("New purchase order", "أمر شراء جديد")}
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
                  placeholder={t("Search purchase orders…", "ابحث عن أوامر الشراء…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("orders", "أمر")}</div>
              </div>
            }
            emptyTitle={t("No purchase orders yet", "لا توجد أوامر شراء بعد")}
            emptyDescription={t("Create a purchase order to begin the approval and receiving workflow.", "أنشئ أمر شراء لبدء سير عمل الاعتماد والاستلام.")}
          />
        )}
      </div>

      <PurchaseOrderFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        order={editing}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, costPrice: p.costPrice }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
        currencies={currencies.length > 0 ? currencies.map((c) => ({ code: c.code, name: c.name })) : [{ code: "EGP", name: "Egyptian Pound" }, { code: "USD", name: "US Dollar" }]}
        onSave={handleSave}
      />

      <Dialog open={Boolean(receiving)} onOpenChange={(open) => { if (!open) setReceiving(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Receive goods", "استلام البضاعة")}</DialogTitle>
            <DialogDescription>
              {t("Enter quantities received for each line. Creates a purchase invoice.", "أدخل الكميات المستلمة لكل سطر. سيتم إنشاء فاتورة مشتريات.")}
            </DialogDescription>
          </DialogHeader>
          {receiving ? (
            <div className="space-y-2">
              {receiving.lines.map((l) => {
                const remaining = Math.max(0, l.quantity - l.receivedQty);
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{l.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("Ordered", "مطلوب")}: {l.quantity} · {t("Received", "مستلم")}: {l.receivedQty}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      className="w-24 text-end"
                      value={receiveQty[l.id] ?? 0}
                      onChange={(e) => setReceiveQty((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiving(null)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={confirmReceive} loading={receivingBusy}>
              <PackageCheck className="size-4" />
              {t("Receive", "استلام")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete purchase order?", "حذف أمر الشراء؟")}
        description={t("This will permanently remove the purchase order.", "سيؤدي هذا إلى حذف أمر الشراء نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}