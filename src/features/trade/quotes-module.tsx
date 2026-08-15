import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, FileText, MoreHorizontal, Pencil, ArrowRightLeft, Trash2 } from "lucide-react";
import { useQuotesStore } from "@/stores/quotes-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { formatCurrency, formatDate } from "@/lib/format";
import { quotesApi, invoicesApi } from "@/lib/api";
import { hydrateInvoices, hydrateParties } from "@/lib/api/hydration";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { Quote, Party, Product, Warehouse } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { QuoteFormDialog } from "./quote-form-dialog";

const columnHelper = createColumnHelper<Quote>();

const statusVariant = (status: Quote["status"]) =>
  status === "converted" ? "success" : status === "accepted" ? "success" : status === "rejected" || status === "expired" ? "destructive" : status === "sent" ? "warning" : "muted";

interface QuotesPageProps {
  kind: "sale" | "purchase";
  getParties: () => Party[];
  getProducts: () => Product[];
  getWarehouses: () => Warehouse[];
}

export function QuotesModule({ kind, getParties, getProducts, getWarehouses }: QuotesPageProps) {
  const items = useQuotesStore((s) => s.items);
  const add = useQuotesStore((s) => s.add);
  const update = useQuotesStore((s) => s.update);
  const remove = useQuotesStore((s) => s.remove);
  const upsertInvoice = useInvoicesStore((s) => s.upsert);
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const actorName = useAuthStore((s) => s.currentUser?.name) ?? "—";

  const { t } = useT();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const canCreate = usePermission("quotes.create");
  const canUpdate = usePermission("quotes.update");
  const canDelete = usePermission("quotes.delete");
  const loading = useSimulatedLoading(600, [search]);

  const list = useMemo(() => items.filter((q) => q.kind === kind), [items, kind]);
  const partyMap = useMemo(() => new Map(getParties().map((p) => [p.id, p])), [getParties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const party = partyMap.get(item.partyId);
      return [item.number, party?.name ?? "", item.status].join(" ").toLowerCase().includes(q);
    });
  }, [list, search, partyMap]);

  const totalQuotes = Math.round(list.filter((q) => q.status !== "rejected" && q.status !== "expired").reduce((s, q) => s + q.total, 0) * 100) / 100;
  const convertedCount = list.filter((q) => q.status === "converted").length;

  const convert = async (quote: Quote) => {
    try {
      const result = await quotesApi().convert(kind, quote.id);
      update(result.quote.id, result.quote);
      const invoice = await invoicesApi().get(kind, result.invoiceId);
      upsertInvoice(invoice);
      toast.success(
        t("${number} converted to ${invoice}", "تم تحويل ${number} إلى ${invoice}")
          .replace("${number}", quote.number)
          .replace("${invoice}", invoice.number),
      );
      addNotification({
        kind: "success",
        title: t("Quote converted", "تم تحويل عرض السعر"),
        message: t(
          "${actor} converted ${number} into invoice ${invoice}.",
          "${actor} حوّل ${number} إلى فاتورة ${invoice}.",
        )
          .replace("${actor}", actorName)
          .replace("${number}", quote.number)
          .replace("${invoice}", invoice.number),
      });
      void hydrateParties();
      void hydrateInvoices();
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const handleDelete = async (quote: Quote) => {
    try {
      await quotesApi().remove(kind, quote.id);
      remove(quote.id);
      toast.success(t("${number} deleted", "تم حذف ${number}").replace("${number}", quote.number));
    } catch (error) {
      toast.error(translateApiError(error, t));
    }
  };

  const handleSave = (quote: Quote) => {
    if (editing) update(editing.id, quote);
    else add(quote);
    addNotification({
      kind: "success",
      title: t("Quote recorded", "تم تسجيل عرض السعر"),
      message: t(
        "${actor} recorded ${number} (${amount}).",
        "${actor} سجّل ${number} (${amount}).",
      )
        .replace("${actor}", actorName)
        .replace("${number}", quote.number)
        .replace("${amount}", formatCurrency(quote.total)),
    });
  };

  const columns = useMemo<ColumnDef<Quote, any>[]>(
    () =>
      buildColumns({
        t,
        kind,
        partyMap,
        canUpdate,
        canDelete,
        onEdit: setEditing,
        onConvert: convert,
        onDelete: handleDelete,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, partyMap, canUpdate, canDelete],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(kind === "sale" ? "Sales Quotes" : "Purchase Quotes", kind === "sale" ? "عروض أسعار المبيعات" : "عروض أسعار المشتريات")}
        description={t(
          "Create quotes and convert them into invoices when accepted.",
          "أنشئ عروض أسعار وحوّلها إلى فواتير عند قبولها.",
        )}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New {t("quote", "عرض سعر")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label={t("Quotes total", "إجمالي عروض الأسعار")}
          value={formatCurrency(totalQuotes)}
          sub={`${list.length} ${t("quotes", "عرض سعر")}`}
        />
        <SummaryCard
          label={t("Converted to invoices", "تم تحويلها إلى فواتير")}
          value={String(convertedCount)}
          sub={t("Accepted quotes become invoices", "تتحول عروض الأسعار المقبولة إلى فواتير")}
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
                  placeholder={t("Search quotes…", "البحث في عروض الأسعار…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("records", "سجلات")}</div>
              </div>
            }
            emptyTitle={t("No quotes yet", "لا توجد عروض أسعار بعد")}
            emptyDescription={t("Create your first quote to get started.", "أنشئ أول عرض سعر لبدء العمل.")}
          />
        )}
      </div>

      <QuoteFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        kind={kind}
        quote={editing}
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
  onConvert,
  onDelete,
}: {
  t: TranslateFn;
  kind: "sale" | "purchase";
  partyMap: Map<string, Party>;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (q: Quote) => void;
  onConvert: (q: Quote) => void;
  onDelete: (q: Quote) => void;
}): ColumnDef<Quote, any>[] {
  return [
    columnHelper.accessor("number", {
      header: t("Number", "الرقم"),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <span className="font-medium">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "party",
      header: t(kind === "sale" ? "Customer" : "Supplier", kind === "sale" ? "العميل" : "المورد"),
      cell: (info) => partyMap.get(info.row.original.partyId)?.name ?? "—",
    }),
    columnHelper.accessor("quoteDate", {
      header: t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("validUntil", {
      header: t("Valid until", "صالح حتى"),
      enableSorting: false,
      cell: (info) => (info.getValue() ? formatDate(info.getValue()!) : "—"),
    }),
    columnHelper.accessor("total", {
      header: t("Amount", "المبلغ"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(info.getValue())}</span>,
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
        const quote = info.row.original;
        const convertible = quote.status !== "converted";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate && convertible ? (
                <DropdownMenuItem onClick={() => onConvert(quote)}>
                  <ArrowRightLeft className="size-4" /> {t("Convert to invoice", "تحويل إلى فاتورة")}
                </DropdownMenuItem>
              ) : null}
              {canUpdate && convertible ? (
                <DropdownMenuItem onClick={() => onEdit(quote)}>
                  <Pencil className="size-4" /> {t("Edit", "تعديل")}
                </DropdownMenuItem>
              ) : null}
              {canDelete && convertible ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(quote)}>
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
