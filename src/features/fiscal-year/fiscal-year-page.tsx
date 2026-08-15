import { useMemo, useState } from "react";
import { Lock, Plus, Unlock } from "lucide-react";
import { useFiscalYearsStore } from "@/stores/fiscal-year-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { fiscalYearApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { FiscalYear } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { EmptyState } from "@/shared/components/feedback/states";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { FiscalYearFormDialog } from "./fiscal-year-form-dialog";

export function FiscalYearPage() {
  const { t } = useT();
  const years = useFiscalYearsStore((s) => s.items);
  const canManage = usePermission("accounting.post");

  const [createOpen, setCreateOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<FiscalYear | null>(null);
  const [closing, setClosing] = useState(false);
  const loading = useSimulatedLoading(600);

  const summary = useMemo(() => {
    const open = years.filter((y) => y.status === "open");
    const totalRevenue = years.reduce((s, y) => s + y.revenue, 0);
    const totalNet = years.reduce((s, y) => s + y.netProfit, 0);
    return { openCount: open.length, totalRevenue, totalNet };
  }, [years]);

  const handleClose = async () => {
    if (!closeTarget) return;
    setClosing(true);
    try {
      const record = await fiscalYearApi().close(closeTarget.id);
      useFiscalYearsStore.getState().upsert(record);
      toast.success(t("${name} closed", "تم إقفال ${name}").replace("${name}", closeTarget.name));
      setCloseTarget(null);
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Fiscal Year", "السنة المالية")}
        description={t("Open and close fiscal years. Closing moves profit or loss to retained earnings and locks the period.", "افتح وأقفل السنوات المالية. الإقفال ينقل الربح أو الخسارة إلى الأرباح المحتجزة ويقفل الفترة.")}
      >
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Open fiscal year", "فتح سنة مالية")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Open years", "سنوات مفتوحة")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.openCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Total revenue", "إجمالي الإيرادات")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{formatCurrency(summary.totalRevenue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Net profit", "صافي الربح")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(summary.totalNet)}</p>
        </Card>
      </div>

      <Card className="p-4">
        {loading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : years.length === 0 ? (
          <EmptyState
            title={t("No fiscal years", "لا توجد سنوات مالية")}
            description={t("Open a fiscal year to start posting period-scoped balances.", "افتح سنة مالية لبدء ترحيل الأرصدة الخاصة بالفترة.")}
          />
        ) : (
          <div className="space-y-3">
            {years.map((year) => (
              <YearRow key={year.id} year={year} canManage={canManage} onClose={setCloseTarget} />
            ))}
          </div>
        )}
      </Card>

      <FiscalYearFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={(year) => useFiscalYearsStore.getState().add(year)}
      />

      <ConfirmDialog
        open={Boolean(closeTarget)}
        onOpenChange={(open) => {
          if (!open) setCloseTarget(null);
        }}
        title={t("Close this fiscal year?", "إقفال هذه السنة المالية؟")}
        description={t(
          "Closing posts a year-end journal to retained earnings and prevents new journal entries in this period. This cannot be undone.",
          "الإقفال يرحّل قيد نهاية السنة إلى الأرباح المحتجزة ويمنع إضافة قيود جديدة في هذه الفترة. لا يمكن التراجع عن هذا الإجراء.",
        )}
        confirmLabel={t("Close year", "إقفال السنة")}
        loading={closing}
        onConfirm={() => void handleClose()}
      />
    </div>
  );
}

function YearRow({ year, canManage, onClose }: { year: FiscalYear; canManage: boolean; onClose: (year: FiscalYear) => void }) {
  const { t } = useT();
  const closed = year.status === "closed";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {closed ? <Lock className="size-5" /> : <Unlock className="size-5" />}
        </span>
        <div>
          <p className="font-medium">{year.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(year.startDate)} — {formatDate(year.endDate)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t("Revenue", "الإيرادات")}</p>
          <p className="font-medium tabular-nums">{formatCurrency(year.revenue)}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t("Expenses", "المصروفات")}</p>
          <p className="font-medium tabular-nums">{formatCurrency(year.expenses)}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t("Net profit", "صافي الربح")}</p>
          <p className="font-medium tabular-nums">{formatCurrency(year.netProfit)}</p>
        </div>
        <Badge variant={closed ? "muted" : "success"} dot className="capitalize">
          {closed ? t("Closed", "مقفلة") : t("Open", "مفتوحة")}
        </Badge>
        {canManage && !closed ? (
          <Button variant="outline" size="sm" onClick={() => onClose(year)}>
            <Lock className="size-3.5" />
            {t("Close", "إقفال")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
