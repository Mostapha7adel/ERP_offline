import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, ReceiptText, Download, MoreHorizontal, Printer, PackageCheck, Pencil } from "lucide-react";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBankAccountsStore } from "@/stores/treasury-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildInvoiceHtml, downloadHtmlFile, printHtml } from "@/lib/export";
import { invoicesApi } from "@/lib/api";
import { hydrateInventory, hydrateParties, hydrateTreasury } from "@/lib/api/hydration";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { useSettingsStore } from "@/stores/settings-store";
import type { Invoice, Party, Product, Warehouse, StockItem } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { InvoiceFormDialog } from "./invoice-form-dialog";
import { InvoiceDetailDrawer } from "./invoice-detail-drawer";
import { PaymentFormDialog } from "./payment-form-dialog";

const columnHelper = createColumnHelper<Invoice>();

const statusVariant = (status: Invoice["status"]) =>
  status === "paid" ? "success" : status === "overdue" ? "destructive" : status === "draft" ? "muted" : "warning";

interface InvoicesPageProps {
  kind: "sale" | "purchase";
  getParties: () => Party[];
  getProducts: () => Product[];
  getWarehouses: () => Warehouse[];
  getStock: () => StockItem[];
}

export function InvoicesModule({ kind, getParties, getProducts, getWarehouses, getStock }: InvoicesPageProps) {
  const items = useInvoicesStore((s) => s.items);
  const add = useInvoicesStore((s) => s.add);
  const update = useInvoicesStore((s) => s.update);
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const actorName = useAuthStore((s) => s.currentUser?.name) ?? "—";

  const { t } = useT();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const bankAccounts = useBankAccountsStore((s) => s.items);
  const canCreate = usePermission(kind === "sale" ? "sales.create" : "purchases.create");
  const canUpdate = usePermission(kind === "sale" ? "sales.update" : "purchases.update");
  const canVoid = usePermission(kind === "sale" ? "sales.delete" : "purchases.delete");
  const loading = useSimulatedLoading(600, [search]);

  const list = useMemo(() => items.filter((i) => i.kind === kind), [items, kind]);
  const partyMap = useMemo(() => new Map(getParties().map((p) => [p.id, p])), [getParties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => {
      const party = partyMap.get(i.partyId);
      return [i.number, party?.name ?? "", i.status].join(" ").toLowerCase().includes(q);
    });
  }, [list, search, partyMap]);

  const outstanding = list.filter((i) => i.status === "pending" || i.status === "overdue");
  const totalOutstanding = Math.round(outstanding.reduce((s, i) => s + (i.total - i.paid), 0) * 100) / 100;

  const markPaid = (invoice: Invoice) => {
    setPaying(invoice);
    setPayOpen(true);
  };

  const handlePaymentSaved = async (updated: Invoice) => {
    update(updated.id, updated);
    toast.success(t("${number} marked as paid", "${number} تم تحديده كمدفوع").replace("${number}", updated.number));
    addNotification({
      kind: "success",
      title: t(kind === "sale" ? "Sale paid" : "Purchase paid", kind === "sale" ? "تم دفع البيع" : "تم دفع الشراء"),
      message: t(
        "${actor} marked ${number} as paid (${amount}).",
        "${actor} حدّد ${number} كمدفوع (${amount}).",
      )
        .replace("${actor}", actorName)
        .replace("${number}", updated.number)
        .replace("${amount}", formatCurrency(updated.paid)),
    });
    syncStock();
    setDetail(null);
  };

  const markReceived = async (invoice: Invoice) => {
    try {
      const updated = await invoicesApi().receivePurchase(invoice.id, {
        warehouseId: invoice.warehouseId,
      });
      update(updated.id, updated);
      toast.success(t("${number} received into warehouse", "${number} تم استلامها في المستودع").replace("${number}", updated.number));
      addNotification({
        kind: "success",
        title: t("Purchase received", "تم استلام المشتريات"),
        message: t(
          "${actor} received ${number} into the warehouse (${amount}).",
          "${actor} استلم ${number} في المستودع (${amount}).",
        )
          .replace("${actor}", actorName)
          .replace("${number}", updated.number)
          .replace("${amount}", formatCurrency(updated.total)),
      });
      syncStock();
      setDetail(null);
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const markVoid = async (invoice: Invoice) => {
    try {
      const updated = await invoicesApi().void(kind, invoice.id);
      update(updated.id, updated);
      toast.success(t("${number} cancelled", "${number} تم إلغاؤها").replace("${number}", updated.number));
      addNotification({
        kind: "warning",
        title: t(kind === "sale" ? "Sale cancelled" : "Purchase cancelled", kind === "sale" ? "تم إلغاء البيع" : "تم إلغاء الشراء"),
        message: t(
          "${actor} cancelled ${number} — stock was returned and any payment refunded.",
          "${actor} ألغى ${number} — أُعيد المخزون واستُرجع أي مبلغ مدفوع.",
        )
          .replace("${actor}", actorName)
          .replace("${number}", updated.number),
      });
      syncStock();
      setDetail(null);
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const syncStock = () => {
    // Re-pull stock + party balances + treasury after any transaction that
    // changes inventory/receivables/cash, so the UI reflects it without a reload.
    void hydrateInventory();
    void hydrateParties();
    void hydrateTreasury();
  };

  const handleSave = (invoice: Invoice) => {
    if (editing) update(editing.id, invoice);
    else add(invoice);
    syncStock();
    addNotification({
      kind: "success",
      title: t(kind === "sale" ? "Sale recorded" : "Purchase recorded", kind === "sale" ? "تم تسجيل البيع" : "تم تسجيل الشراء"),
      message: t(
        "${actor} recorded ${number} (${amount}).",
        "${actor} سجّل ${number} (${amount}).",
      )
        .replace("${actor}", actorName)
        .replace("${number}", invoice.number)
        .replace("${amount}", formatCurrency(invoice.total)),
    });
  };

  const companyName = useSettingsStore((s) => s.company.name);

  const invoiceHtml = (invoice: Invoice) => {
    const party = partyMap.get(invoice.partyId);
    const partyLabel = t(kind === "sale" ? "Customer" : "Supplier", kind === "sale" ? "العميل" : "المورد");
    const documentTitle = t(
      kind === "sale" ? "Sales Invoice" : "Purchase Order",
      kind === "sale" ? "فاتورة مبيعات" : "أمر شراء",
    );
    return buildInvoiceHtml({
      companyName,
      documentTitle,
      number: invoice.number,
      dateLabel: t("Date", "التاريخ"),
      dateValue: formatDate(invoice.issueDate),
      dueLabel: t("Due", "الاستحقاق"),
      dueValue: formatDate(invoice.dueDate),
      partyLabel,
      partyName: party?.name ?? t("Unknown", "غير معروف"),
      partyDetail: party?.email || undefined,
      rows: invoice.lines.map((line) => ({
        description: line.description || line.productId,
        quantity: String(line.quantity),
        price: formatCurrency(line.unitPrice, invoice.currency),
        total: formatCurrency(line.lineTotal, invoice.currency),
      })),
      subtotalLabel: t("Subtotal", "المجموع الفرعي"),
      subtotal: formatCurrency(invoice.subtotal, invoice.currency),
      taxLabel: t("Tax", "الضريبة"),
      tax: formatCurrency(invoice.tax, invoice.currency),
      totalLabel: t("Total", "الإجمالي"),
      total: formatCurrency(invoice.total, invoice.currency),
      currency: invoice.currency,
    });
  };

  const downloadInvoice = async (invoice: Invoice) => {
    const saved = await downloadHtmlFile(`${invoice.number}.html`, invoiceHtml(invoice));
    if (saved) toast.success(t("Invoice saved", "تم حفظ الفاتورة"));
  };

  const printInvoice = (invoice: Invoice) => {
    printHtml(invoice.number, invoiceHtml(invoice));
  };

  const columns = useMemo<ColumnDef<Invoice, any>[]>(
    () =>
      buildColumns({
        t,
        kind,
        partyMap,
        onView: setDetail,
        canUpdate,
        canVoid,
        onEdit: setEditing,
        onMarkPaid: markPaid,
        onMarkReceived: markReceived,
        onVoid: markVoid,
        onDownload: downloadInvoice,
        onPrint: printInvoice,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, partyMap, canUpdate],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(kind === "sale" ? "Sales" : "Purchases", kind === "sale" ? "المبيعات" : "المشتريات")}
        description={t(
          kind === "sale"
            ? "Create and track sales invoices and receivables."
            : "Manage purchase orders and accounts payable.",
          kind === "sale"
            ? "أنشئ وتابع فواتير المبيعات والمستحقات."
            : "إدارة أوامر الشراء والحسابات الدائنة.",
        )}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New {t(kind === "sale" ? "invoice" : "order", kind === "sale" ? "فاتورة" : "أمر شراء")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label={t(kind === "sale" ? "Invoices recorded" : "Orders recorded", kind === "sale" ? "الفواتير المسجلة" : "الطلبات المسجلة")}
          value={String(list.length)}
          sub={formatCurrency(Math.round(list.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0) * 100) / 100)}
        />
        <SummaryCard
          label={t(kind === "sale" ? "Outstanding receivables" : "Outstanding payables", kind === "sale" ? "المستحقات غير المسددة" : "المطلوبات غير المسددة")}
          value={formatCurrency(totalOutstanding)}
          sub={`${outstanding.length} ${t(kind === "sale" ? "open invoices" : "open orders", kind === "sale" ? "فواتير مفتوحة" : "طلبات مفتوحة")}`}
          danger
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => setDetail(row)}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t(kind === "sale" ? "Search invoices…" : "Search orders…", kind === "sale" ? "البحث في الفواتير…" : "البحث في الطلبات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("records", "سجلات")}</div>
              </div>
            }
            emptyTitle={t(kind === "sale" ? "No invoices yet" : "No orders yet", kind === "sale" ? "لا توجد فواتير بعد" : "لا توجد طلبات بعد")}
            emptyDescription={t("Create your first record to get started.", "أنشئ أول سجل لبدء العمل.")}
          />
        )}
      </div>

      <InvoiceFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        kind={kind}
        invoice={editing}
        parties={getParties()}
        products={getProducts()}
        warehouses={getWarehouses()}
        stock={getStock()}
        accounts={bankAccounts}
        onSave={handleSave}
      />

      <PaymentFormDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        kind={kind}
        invoice={paying}
        accounts={bankAccounts}
        onSaved={handlePaymentSaved}
        onClosed={() => setPaying(null)}
      />

      <InvoiceDetailDrawer
        invoice={detail}
        kind={kind}
        party={detail ? partyMap.get(detail.partyId) ?? null : null}
        onOpenChange={() => setDetail(null)}
        onMarkPaid={detail && (detail.status === "pending" || detail.status === "overdue") ? () => markPaid(detail) : undefined}
        onMarkReceived={detail && detail.kind === "purchase" && !detail.received && detail.status !== "cancelled" ? () => markReceived(detail) : undefined}
        onVoid={detail ? () => markVoid(detail) : undefined}
        onDownload={detail ? () => downloadInvoice(detail) : undefined}
        onPrint={detail ? () => printInvoice(detail) : undefined}
      />
    </div>
  );
}

function buildColumns({
  t,
  kind,
  partyMap,
  onView,
  canUpdate,
  canVoid,
  onEdit,
  onMarkPaid,
  onMarkReceived,
  onVoid,
  onDownload,
  onPrint,
}: {
  t: TranslateFn;
  kind: "sale" | "purchase";
  partyMap: Map<string, Party>;
  onView: (i: Invoice) => void;
  canUpdate: boolean;
  canVoid: boolean;
  onEdit: (i: Invoice) => void;
  onMarkPaid: (i: Invoice) => void;
  onMarkReceived: (i: Invoice) => void;
  onVoid: (i: Invoice) => void;
  onDownload: (i: Invoice) => void;
  onPrint: (i: Invoice) => void;
}): ColumnDef<Invoice, any>[] {
  return [
    columnHelper.accessor("number", {
      header: t("Number", "الرقم"),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground" />
          <span className="font-medium">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "party",
      header: t(kind === "sale" ? "Customer" : "Supplier", kind === "sale" ? "العميل" : "المورد"),
      cell: (info) => partyMap.get(info.row.original.partyId)?.name ?? "—",
    }),
    columnHelper.accessor("issueDate", {
      header: t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("dueDate", {
      header: t("Due", "الاستحقاق"),
      enableSorting: false,
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("total", {
      header: t("Amount", "المبلغ"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("warehouseName", {
      header: t("Warehouse", "المستودع"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("status", {
      header: t("Status", "الحالة"),
      cell: (info) => (
        <Badge variant={statusVariant(info.getValue())} dot className="capitalize">
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const invoice = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(invoice)}>{t("View details", "عرض التفاصيل")}</DropdownMenuItem>
              {canUpdate && invoice.status === "pending" ? (
                <DropdownMenuItem onClick={() => onEdit(invoice)}>
                  <Pencil className="size-4" /> {t("Edit", "تعديل")}
                </DropdownMenuItem>
              ) : null}
              {canUpdate && (invoice.status === "pending" || invoice.status === "overdue") ? (
                <DropdownMenuItem onClick={() => onMarkPaid(invoice)}>
                  {t("Mark as paid", "تحديد كمدفوع")}
                </DropdownMenuItem>
              ) : null}
              {canUpdate && kind === "purchase" && !invoice.received && invoice.status !== "cancelled" ? (
                <DropdownMenuItem onClick={() => onMarkReceived(invoice)}>
                  <PackageCheck className="size-4" /> {t("Mark as received", "تحديد كمستلم")}
                </DropdownMenuItem>
              ) : null}
              {canVoid && invoice.status !== "cancelled" ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onVoid(invoice)}
                >
                  {t("Cancel transaction", "إلغاء المعاملة")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => onDownload(invoice)}>
                <Download className="size-4" /> {t("Download", "تنزيل")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPrint(invoice)}>
                <Printer className="size-4" /> {t("Print", "طباعة")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];
}

function SummaryCard({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}