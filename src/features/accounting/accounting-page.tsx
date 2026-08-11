import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Landmark, BookOpen, Plus } from "lucide-react";
import { useAccountsStore, useJournalStore } from "@/stores/accounting-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { StateShell } from "@/shared/components/feedback/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import type { Account, JournalEntry, AccountType } from "@/types/domain";
import { AccountFormDialog } from "./account-form-dialog";

const accountColumnHelper = createColumnHelper<Account>();

const typeMeta: Record<AccountType, { label: string; labelAr: string; tone: "success" | "destructive" | "info" | "warning" | "muted" }> = {
  asset: { label: "Asset", labelAr: "أصل", tone: "info" },
  liability: { label: "Liability", labelAr: "التزام", tone: "warning" },
  equity: { label: "Equity", labelAr: "حقوق ملكية", tone: "muted" },
  revenue: { label: "Revenue", labelAr: "إيراد", tone: "success" },
  expense: { label: "Expense", labelAr: "مصروف", tone: "destructive" },
};

export function AccountingPage() {
  const accounts = useAccountsStore((s) => s.items);
  const entries = useJournalStore((s) => s.items);
  const canPost = usePermission("accounting.post");
  const { t } = useT();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const loading = useSimulatedLoading(650);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => [a.name, a.code, a.category, a.type].join(" ").toLowerCase().includes(q));
  }, [accounts, search]);

  const summary = useMemo(() => {
    const assets = accounts.filter((a) => a.type === "asset").reduce((s, a) => s + a.balance, 0);
    const liabilities = accounts.filter((a) => a.type === "liability").reduce((s, a) => s + a.balance, 0);
    const equity = accounts.filter((a) => a.type === "equity").reduce((s, a) => s + a.balance, 0);
    return { assets, liabilities, equity };
  }, [accounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Accounting", "المحاسبة")}
        description={t("Chart of accounts and double-entry journal.", "دليل الحسابات وقيود اليومية ذات القيد المزدوج.")}
      >
        {canPost ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Add account", "إضافة حساب")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <BalanceCard label={t("Total assets", "إجمالي الأصول")} value={formatCurrency(summary.assets)} tone="info" />
        <BalanceCard label={t("Total liabilities", "إجمالي الالتزامات")} value={formatCurrency(summary.liabilities)} tone="warning" />
        <BalanceCard label={t("Total equity", "إجمالي حقوق الملكية")} value={formatCurrency(summary.equity)} tone="success" />
      </div>

      <Card>
        <Tabs defaultValue="accounts">
          <div className="flex items-center justify-between border-b px-4 pt-3">
            <TabsList>
              <TabsTrigger value="accounts" className="gap-2">
                <Landmark className="size-4" /> {t("Chart of Accounts", "دليل الحسابات")}
              </TabsTrigger>
              <TabsTrigger value="journal" className="gap-2">
                <BookOpen className="size-4" /> {t("Journal", "اليومية")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="accounts" className="mt-0 p-4">
            {loading ? (
              <SkeletonTable rows={8} columns={4} />
            ) : (
              <DataTable
                columns={buildAccountColumns(t)}
                data={filteredAccounts}
                toolbar={
                  <div className="mb-4">
                    <SearchInput
                      placeholder={t("Search accounts…", "البحث في الحسابات…")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClear={() => setSearch("")}
                      className="w-full sm:w-72"
                    />
                  </div>
                }
                emptyTitle={t("No accounts found", "لا توجد حسابات")}
                emptyDescription={t("Adjust your search or add a new account.", "عدّل البحث أو أضف حساباً جديداً.")}
                pagination
                pageSize={10}
              />
            )}
          </TabsContent>

          <TabsContent value="journal" className="mt-0 p-4">
            {loading ? (
              <SkeletonTable rows={8} columns={3} />
            ) : (
              <JournalTable entries={entries} />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <AccountFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={(account) => useAccountsStore.getState().add(account)}
      />
    </div>
  );
}

function BalanceCard({ label, value, tone }: { label: string; value: string; tone: "info" | "warning" | "success" }) {
  const toneClass = { info: "text-info", warning: "text-warning", success: "text-success" }[tone];
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </Card>
  );
}

function buildAccountColumns(t: TranslateFn): ColumnDef<Account, any>[] {
  return [
    accountColumnHelper.accessor("code", { header: t("Code", "الرمز"), cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span> }),
    accountColumnHelper.accessor("name", { header: t("Account", "الحساب"), cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
    accountColumnHelper.accessor("type", {
      header: t("Type", "النوع"),
      cell: (info) => {
        const meta = typeMeta[info.getValue() as AccountType];
        return <Badge variant={meta.tone} className="capitalize">{t(meta.label, meta.labelAr)}</Badge>;
      },
    }),
    accountColumnHelper.accessor("category", { header: t("Category", "الفئة"), cell: (info) => info.getValue() }),
    accountColumnHelper.accessor("balance", {
      header: t("Balance", "الرصيد"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(info.getValue())}</span>,
    }),
  ];
}

function JournalTable({ entries }: { entries: JournalEntry[] }) {
  const { t } = useT();
  const accounts = useAccountsStore((s) => s.items);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <StateShell
          size="sm"
          title={t("No journal entries recorded", "لا توجد قيود يومية مسجلة")}
          description={t("Posted transactions will appear here as double-entry journal lines.", "ستظهر المعاملات المُرحّلة هنا كأسطر قيود اليومية ذات القيد المزدوج.")}
        />
      ) : (
        entries.map((entry) => {
          const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
          const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
          return (
            <div key={entry.id} className="rounded-xl border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{entry.number}</span>
                  <Badge variant={entry.status === "posted" ? "success" : entry.status === "reversed" ? "destructive" : "muted"} dot className="capitalize">
                    {entry.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{formatDate(entry.date)}</span>
                  <span>{entry.reference}</span>
                  <span className="tabular-nums">{formatCurrency(totalDebit)}</span>
                </div>
              </div>
              <div className="px-4 py-2 text-sm text-muted-foreground">{entry.description}</div>
              <div className="grid grid-cols-1 gap-x-8 px-4 pb-3 md:grid-cols-2">
                {entry.lines.map((line) => {
                  const account = accountMap.get(line.accountId);
                  return (
                    <div key={line.id} className="flex items-center justify-between py-0.5">
                      <span className="text-sm">{account?.code} — {account?.name ?? t("Unknown", "غير معروف")}</span>
                      <span className="tabular-nums text-sm">
                        {line.debit > 0 ? `Dr ${formatCurrency(line.debit)}` : `Cr ${formatCurrency(line.credit)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between border-t px-4 py-1.5 text-xs text-muted-foreground">
                <span>{t("Balanced", "متوازن")}: {Math.abs(totalDebit - totalCredit) < 0.001 ? t("Yes", "نعم") : t("No", "لا")}</span>
                <span>{formatNumber(entry.lines.length)} {t("lines", "سطور")}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}