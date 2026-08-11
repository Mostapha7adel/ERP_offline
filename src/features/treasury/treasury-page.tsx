import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Landmark, MoreHorizontal } from "lucide-react";
import { useBankAccountsStore, useTransactionsStore } from "@/stores/treasury-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { buildOutstanding } from "@/lib/analytics";
import { treasuryApi } from "@/lib/api/services";
import { hydrateTreasury } from "@/lib/api/hydration";
import { usePermission } from "@/shared/components/permission-gate";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/shared/lib/toast";
import type { MoneyTransaction } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { StateShell } from "@/shared/components/feedback/states";
import { TransactionFormDialog } from "./transaction-form-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const columnHelper = createColumnHelper<MoneyTransaction>();

const typeMeta = {
  inflow: { icon: ArrowDownLeft, tone: "success" },
  outflow: { icon: ArrowUpRight, tone: "destructive" },
  transfer: { icon: ArrowLeftRight, tone: "info" },
} as const;

const statusVariant = (s: MoneyTransaction["status"]) =>
  s === "completed" ? "success" : s === "failed" || s === "reversed" ? "destructive" : "warning";

export function TreasuryPage() {
  const accounts = useBankAccountsStore((s) => s.items);
  const transactions = useTransactionsStore((s) => s.items);
  const invoices = useInvoicesStore((s) => s.items);
  const add = useTransactionsStore((s) => s.add);
  const remove = useTransactionsStore((s) => s.remove);
  const canCreate = usePermission("treasury.create");
  const { t } = useT();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const loading = useSimulatedLoading(650);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const totalBalance = Math.round(accounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;
  const isThisMonth = (iso: string) => new Date(iso).getMonth() === new Date().getMonth();
  const monthlyInflow = Math.round(
    transactions
      .filter((t) => t.type === "inflow" && isThisMonth(t.date) && t.status !== "reversed")
      .reduce((s, t) => s + t.amount, 0) * 100,
  ) / 100;
  const outstanding = buildOutstanding(invoices);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const acc = accountMap.get(t.bankAccountId);
      return [t.reference, t.category, t.description, acc?.name ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [transactions, search, accountMap]);

  const columns = useMemo<ColumnDef<MoneyTransaction, any>[]>(
    () =>
      buildColumns({
        accountMap,
        onDelete: async (txn) => {
          try {
            await treasuryApi().removeTransaction(txn.id);
            remove(txn.id);
            await hydrateTreasury();
            toast.success(t("Transaction removed", "تم حذف المعاملة"));
          } catch {
            toast.error(t("Failed to delete transaction", "فشل حذف المعاملة"));
          }
        },
        canDelete: canCreate,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountMap, canCreate, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Treasury", "الخزينة")}
        description={t("Monitor bank accounts and cash movements.", "تتبع الحسابات المصرفية وحركات النقد.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Record transaction", "تسجيل معاملة")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary to-[hsl(262_83%_58%)] p-5 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <Wallet className="size-4" />
            {t("Total balance", "إجمالي الرصيد")}
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatCurrency(totalBalance)}</p>
          <p className="mt-1 text-xs opacity-80">{t("${count} accounts", "عبر ${count} حسابات").replace("${count}", String(accounts.length))}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Inflows (this month)", "الواردات (هذا الشهر)")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-success">{formatCurrency(monthlyInflow)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Amount due", "المبلغ المستحق")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-info">{formatCurrency(outstanding.total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("${c} from customers, ${s} to suppliers", "${c} من العملاء، ${s} للموردين")
              .replace("${c}", formatCurrency(outstanding.customers))
              .replace("${s}", formatCurrency(outstanding.suppliers))}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Accounts", "الحسابات")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{accounts.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("${count} active", "${count} نشط").replace("${count}", String(accounts.filter((a) => a.isActive).length))}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {accounts.length === 0 ? (
          <Card className="col-span-full">
            <StateShell
              size="sm"
              title={t("No accounts yet", "لا توجد حسابات بعد")}
              description={t("Create a bank or cash account to start tracking balances.", "أنشئ حساباً مصرفياً أو نقدياً لبدء تتبع الأرصدة.")}
            />
          </Card>
        ) : (
          accounts.map((account) => {
            const Icon = account.type === "cash" ? Wallet : account.type === "credit" ? Landmark : Landmark;
            return (
              <Card key={account.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <Badge variant={account.isActive ? "success" : "muted"} dot>{account.isActive ? t("Active", "نشط") : t("Inactive", "غير نشط")}</Badge>
                </div>
                <p className="mt-3 truncate text-sm font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.number}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{formatCurrency(account.balance)}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{account.type}</p>
              </Card>
            );
          })
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} columns={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput placeholder={t("Search transactions…", "البحث في المعاملات…")} value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} className="w-full sm:w-72" />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("transactions", "معاملات")}</div>
              </div>
            }
            emptyTitle={t("No transactions yet", "لا توجد معاملات بعد")}
            emptyDescription={t("Record your first cash movement to get started.", "سجّل أول حركة نقدية للبدء.")}
          />
        )}
      </div>

      <TransactionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        bankAccounts={accounts}
        onSave={(txn) => {
          add(txn);
        }}
      />
    </div>
  );
}

function buildColumns({
  accountMap,
  onDelete,
  canDelete,
  t,
}: {
  accountMap: Map<string, { id: string; name: string; currency: string }>;
  onDelete: (t: MoneyTransaction) => void;
  canDelete: boolean;
  t: TranslateFn;
}): ColumnDef<MoneyTransaction, any>[] {
  return [
    columnHelper.accessor("reference", {
      header: t("Reference", "المرجع"),
      cell: (info) => {
        const t = info.row.original;
        const meta = typeMeta[t.type];
        const Tone = meta.icon;
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Tone className="size-4" />
            </div>
            <div>
              <p className="font-medium">{t.reference}</p>
              <p className="text-xs text-muted-foreground capitalize">{t.type}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("description", { header: t("Description", "الوصف"), cell: (info) => info.getValue() || "—" }),
    columnHelper.accessor("category", { header: t("Category", "الفئة"), cell: (info) => info.getValue() }),
    columnHelper.display({
      id: "account",
      header: t("Account", "الحساب"),
      cell: (info) => accountMap.get(info.row.original.bankAccountId)?.name ?? "—",
    }),
    columnHelper.accessor("date", {
      header: t("Date", "التاريخ"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("amount", {
      header: t("Amount", "المبلغ"),
      cell: (info) => {
        const t = info.row.original;
        const sign = t.type === "outflow" ? "-" : t.type === "inflow" ? "+" : "";
        const tone = t.type === "inflow" ? "text-success" : t.type === "outflow" ? "text-destructive" : "";
        return <span className={`tabular-nums font-medium ${tone}`}>{sign}{formatCurrency(t.amount)}</span>;
      },
    }),
    columnHelper.accessor("status", {
      header: t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        return (
          <Badge variant={statusVariant(status)} dot className="capitalize">
            {status === "reversed" ? t("Reversed", "ملغاة") : status}
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
            <Button variant="ghost" size="icon-sm" aria-label={t("Actions", "إجراءات")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canDelete && info.row.original.status !== "reversed" ? (
              <DropdownMenuItem onClick={() => onDelete(info.row.original)} className="text-destructive focus:text-destructive">
                {t("Delete", "حذف")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ];
}