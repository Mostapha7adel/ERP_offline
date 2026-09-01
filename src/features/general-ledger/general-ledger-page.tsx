import { useMemo, useState, useEffect } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { BookOpen } from "lucide-react";
import { useGeneralLedgerStore } from "@/stores/general-ledger-store";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { generalLedgerApi, accountingApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { GeneralLedgerEntry } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { Account } from "@/types/domain";

const columnHelper = createColumnHelper<GeneralLedgerEntry>();

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function GeneralLedgerPage() {
  const { t } = useT();
  const report = useGeneralLedgerStore((s) => s.report);
  const hydrate = useGeneralLedgerStore((s) => s.hydrate);
  const simLoading = useSimulatedLoading(600);

  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const loadAccounts = async () => {
    try {
      const data = await accountingApi().accounts();
      setAccounts(data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadReport = async () => {
    if (!accountId) {
      toast.error(t("Please select an account", "يرجى اختيار حساب"));
      return;
    }
    setLoading(true);
    try {
      const data = await generalLedgerApi().getLedger(
        accountId,
        dateFrom || undefined,
        dateTo || undefined,
      );
      hydrate(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load report", "فشل تحميل التقرير"));
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<GeneralLedgerEntry, any>[]>(
    () => [
      columnHelper.accessor("date", {
        header: t("Date", "التاريخ"),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("journalNumber", {
        header: t("Journal #", "رقم القيد"),
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor("description", {
        header: t("Description", "البيان"),
      }),
      columnHelper.accessor("debit", {
        header: t("Debit", "مدين"),
        cell: (info) => {
          const v = info.getValue();
          return <span className="tabular-nums font-medium">{v > 0 ? money(v) : "—"}</span>;
        },
      }),
      columnHelper.accessor("credit", {
        header: t("Credit", "دائن"),
        cell: (info) => {
          const v = info.getValue();
          return <span className="tabular-nums font-medium">{v > 0 ? money(v) : "—"}</span>;
        },
      }),
      columnHelper.accessor("balance", {
        header: t("Balance", "الرصيد"),
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={`tabular-nums font-medium ${v >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {money(v)}
            </span>
          );
        },
      }),
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("General Ledger", "دفتر الأستاذ العام")}
        description={t("View detailed account transactions.", "عرض تفاصيل حركات الحسابات.")}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label>{t("Account", "الحساب")}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t("Select account", "اختر حساب")} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("From", "من")}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>{t("To", "إلى")}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={loadReport} loading={loading}>
          {t("Load Report", "تحميل التقرير")}
        </Button>
      </div>

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Account", "الحساب")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{report.accountCode} — {report.accountName}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Opening Balance", "الرصيد الافتتاحي")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold tabular-nums ${report.openingBalance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {money(report.openingBalance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("Closing Balance", "الرصيد الختامي")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold tabular-nums ${report.closingBalance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {money(report.closingBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            {loading ? (
              <div className="p-4"><SkeletonTable rows={6} columns={6} /></div>
            ) : (
              <DataTable
                columns={columns}
                data={report.entries}
                emptyTitle={t("No data", "لا توجد بيانات")}
                emptyDescription={t("No entries found for this period.", "لم يتم العثور على قيود لهذه الفترة.")}
              />
            )}
          </div>
        </>
      )}

      {!report && !loading && !simLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <BookOpen className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            {t("Select an account and date range to view the general ledger.", "اختر حساباً ونطاق التاريخ لعرض دفتر الأستاذ العام.")}
          </p>
        </div>
      )}
    </div>
  );
}
