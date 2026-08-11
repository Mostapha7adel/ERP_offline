import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Users, Truck, Pencil, Trash2, MoreHorizontal, Eye } from "lucide-react";
import type { EntityStore } from "@/stores/entity-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { usePermission } from "@/shared/components/permission-gate";
import { formatCurrency, formatDate, padNumber } from "@/lib/format";
import { partiesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { useInvoicesStore } from "@/stores/invoices-store";
import type { Party } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { PartyFormDialog } from "./party-form-dialog";
import { PartyDetailDrawer } from "./party-detail-drawer";
import { initials } from "@/lib/utils";

const columnHelper = createColumnHelper<Party>();

interface PartyPageProps {
  type: "customer" | "supplier";
  store: EntityStore<Party>;
}

export function PartyPage({ type, store }: PartyPageProps) {
  const items = store((s) => s.items);
  const add = store((s) => s.add);
  const update = store((s) => s.update);
  const remove = store((s) => s.remove);
  const invoices = useInvoicesStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [detail, setDetail] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState<Party | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission(type === "customer" ? "customers.create" : "suppliers.create");

  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const nextCode = useMemo(() => {
    const maxNum = items.reduce((acc, p) => {
      const num = parseInt(p.code.replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(num) && num > acc ? num : acc;
    }, 0);
    return `${type === "customer" ? "CUS" : "SUP"}-${padNumber(maxNum + 1, 4)}`;
  }, [items, type]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.name, p.code, p.email, p.phone, p.address.city]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  // Outstanding receivable (customer) / payable (supplier) computed from open
  // invoices: total - paid for every invoice that is not settled or void.
  const balanceByParty = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.kind !== (type === "customer" ? "sale" : "purchase")) continue;
      if (inv.status === "paid" || inv.status === "cancelled") continue;
      const amount = Math.max(0, inv.total - inv.paid);
      map.set(inv.partyId, (map.get(inv.partyId) ?? 0) + amount);
    }
    return map;
  }, [invoices, type]);

  const rows = useMemo<Party[]>(
    () =>
      items.map((p) => ({
        ...p,
        balance: Math.round((balanceByParty.get(p.id) ?? 0) * 100) / 100,
      })),
    [items, balanceByParty],
  );

  const handleSave = (party: Party) => {
    if (items.some((p) => p.id === party.id)) update(party.id, party);
    else add(party);
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await partiesApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("${name} deleted", "تم حذف ${name}").replace("${name}", deleting.name));
      } catch (error) {
        toast.error(translateApiError(error, t));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<Party, any>[]>(
    () =>
      buildColumns(type, t, {
        detailView: setDetail,
        edit: setEditing,
        remove: (party) => {
          setDeleting(party);
          setConfirmOpen(true);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={type === "customer" ? t("Customers", "العملاء") : t("Suppliers", "الموردون")}
        description={
          type === "customer"
            ? t("Manage your clients and accounts receivable.", "إدارة عملائك والذمم المدينة.")
            : t("Manage your vendors and accounts payable.", "إدارة مورديك والذمم الدائنة.")
        }
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            {type === "customer" ? <Users className="size-4" /> : <Truck className="size-4" />}
            {type === "customer" ? t("Add customer", "إضافة عميل") : t("Add supplier", "إضافة مورد")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={5} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => setDetail(row)}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={
                    type === "customer"
                      ? t("Search customers…", "ابحث عن العملاء…")
                      : t("Search suppliers…", "ابحث عن الموردين…")
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">
                  {filtered.length} {t("records", "سجلاً")}
                </div>
              </div>
            }
            emptyTitle={
              type === "customer"
                ? t("No customers found", "لا يوجد عملاء")
                : t("No suppliers found", "لا يوجد موردون")
            }
            emptyDescription={t("Add your first record to get started.", "أضف أول سجل لتبدأ.")}
          />
        )}
      </div>

      <PartyFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        type={type}
        party={editing}
        onSave={handleSave}
        nextCode={nextCode}
      />

      <PartyDetailDrawer
        party={detail}
        onOpenChange={() => setDetail(null)}
        onEdit={() => {
          setEditing(detail);
          setDetail(null);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete ${name}?", "حذف ${name}؟").replace("${name}", deleting?.name ?? t("this record", "هذا السجل"))}
        description={t(
          "This will permanently remove the record. Linked transactions are not affected.",
          "سيؤدي هذا إلى حذف السجل نهائياً. المعاملات المرتبطة غير متأثرة.",
        )}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

interface Handlers {
  detailView: (party: Party) => void;
  edit: (party: Party) => void;
  remove: (party: Party) => void;
}

function buildColumns(
  type: "customer" | "supplier",
  t: TranslateFn,
  handlers: Partial<Handlers>,
): ColumnDef<Party, any>[] {
  const statusVariant = (status: Party["status"]) =>
    status === "active" ? ("success" as const) : status === "blocked" ? ("destructive" as const) : ("muted" as const);

  return [
    columnHelper.accessor("name", {
      header: t("Name", "الاسم"),
      cell: (info) => {
        const party = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback>{initials(party.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{party.name}</p>
              <p className="text-xs text-muted-foreground">{party.code}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("email", {
      header: t("Contact", "جهة الاتصال"),
      cell: (info) => {
        const party = info.row.original;
        return (
          <div>
            <p>{party.email || "—"}</p>
            {party.phone ? (
              <p className="text-xs text-muted-foreground">{party.phone}</p>
            ) : null}
          </div>
        );
      },
    }),
    columnHelper.accessor("address.city", {
      header: t("Location", "الموقع"),
      cell: (info) => info.getValue() || "—",
    }),
    columnHelper.accessor("taxId", {
      header: t("Tax ID", "الرقم الضريبي"),
      cell: (info) => info.getValue() || "—",
    }),
    columnHelper.accessor("balance", {
      header: type === "customer" ? t("Outstanding", "المستحق") : t("Payable", "المستحق دفعه"),
      cell: (info) => (
        <span className="tabular-nums">{formatCurrency(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor("status", {
      header: t("Status", "الحالة"),
      cell: (info) => (
        <Badge variant={statusVariant(info.getValue())} dot>
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: t("Created", "تاريخ الإنشاء"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const party = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlers.detailView?.(party)}>
                <Eye className="size-4" /> {t("View", "عرض")}
              </DropdownMenuItem>
              {handlers.edit ? (
                <DropdownMenuItem onClick={() => handlers.edit?.(party)}>
                  <Pencil className="size-4" /> {t("Edit", "تعديل")}
                </DropdownMenuItem>
              ) : null}
              {handlers.remove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handlers.remove?.(party)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" /> {t("Delete", "حذف")}
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