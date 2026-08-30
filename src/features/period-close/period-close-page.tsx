import { useMemo, useState } from "react";
import { Lock, Unlock, Plus } from "lucide-react";
import { usePeriodCloseStore } from "@/stores/period-close-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { periodCloseApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { PeriodClose } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { EmptyState } from "@/shared/components/feedback/states";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function PeriodClosePage() {
  const { t } = useT();
  const periods = usePeriodCloseStore((s) => s.items);
  const canManage = usePermission("period-close.create");
  const [closeTarget, setCloseTarget] = useState<PeriodClose | null>(null);
  const [reopenTarget, setReopenTarget] = useState<PeriodClose | null>(null);
  const [closing, setClosing] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const loading = useSimulatedLoading(600);

  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => b.period.localeCompare(a.period));
  }, [periods]);

  const summary = useMemo(() => {
    const openCount = periods.filter((p) => p.status === "open").length;
    const closedCount = periods.filter((p) => p.status === "closed").length;
    return { openCount, closedCount };
  }, [periods]);

  const handleClose = async () => {
    if (!closeTarget) return;
    setClosing(true);
    try {
      const record = await periodCloseApi().close({
        period: closeTarget.period,
        notes: closeNotes || undefined,
      });
      usePeriodCloseStore.getState().upsert(record);
      toast.success(
        t("Period ${period} closed", "تم إغلاق الفترة ${period}").replace(
          "${period}",
          closeTarget.period,
        ),
      );
      setCloseTarget(null);
      setCloseNotes("");
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget) return;
    setClosing(true);
    try {
      const record = await periodCloseApi().open({
        period: reopenTarget.period,
      });
      usePeriodCloseStore.getState().upsert(record);
      toast.success(
        t("Period ${period} reopened", "تم فتح الفترة ${period}").replace(
          "${period}",
          reopenTarget.period,
        ),
      );
      setReopenTarget(null);
      setReopenOpen(false);
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("Period Close", "إغلاق الفترات")}
          description={t("Manage accounting period close/open operations", "إدارة عمليات إغلاق وفتح الفترات المحاسبية")}
        />
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Period Close", "إغلاق الفترات")}
        description={t("Manage accounting period close/open operations", "إدارة عمليات إغلاق وفتح الفترات المحاسبية")}
      >
        {canManage ? (
          <Button onClick={() => {
            const now = new Date();
            const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            setCloseTarget({ id: "", period, status: "open", createdAt: "", updatedAt: "" });
          }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("Close Period", "إغلاق فترة")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">{t("Total Periods", "إجمالي الفترات")}</div>
          <div className="text-2xl font-bold">{periods.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">{t("Open", "مفتوحة")}</div>
          <div className="text-2xl font-bold text-green-600">{summary.openCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">{t("Closed", "مغلقة")}</div>
          <div className="text-2xl font-bold text-red-600">{summary.closedCount}</div>
        </Card>
      </div>

      {sortedPeriods.length === 0 ? (
        <EmptyState
          title={t("No periods yet", "لا توجد فترات بعد")}
          description={t(
            "Periods are created automatically when you close the first one.",
            "يتم إنشاء الفترات تلقائياً عند إغلاق أول فترة.",
          )}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">{t("Period", "الفترة")}</th>
                  <th className="p-3 text-left font-medium">{t("Status", "الحالة")}</th>
                  <th className="p-3 text-left font-medium">{t("Closed At", "تاريخ الإغلاق")}</th>
                  <th className="p-3 text-left font-medium">{t("Closed By", "أغلق بواسطة")}</th>
                  <th className="p-3 text-left font-medium">{t("Notes", "ملاحظات")}</th>
                  {canManage && <th className="p-3 text-right font-medium">{t("Actions", "الإجراءات")}</th>}
                </tr>
              </thead>
              <tbody>
                {sortedPeriods.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium">{p.period}</td>
                    <td className="p-3">
                      <Badge variant={p.status === "closed" ? "destructive" : "default"}>
                        {p.status === "closed" ? t("Closed", "مغلقة") : t("Open", "مفتوحة")}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.closedAt ? formatDate(p.closedAt) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.closedBy ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.notes ?? "—"}</td>
                    {canManage && (
                      <td className="p-3 text-right">
                        {p.status === "open" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCloseTarget(p)}
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            {t("Close", "إغلاق")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReopenTarget(p);
                              setReopenOpen(true);
                            }}
                          >
                            <Unlock className="mr-1 h-3 w-3" />
                            {t("Reopen", "فتح")}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!closeTarget} onOpenChange={(open) => { if (!open) { setCloseTarget(null); setCloseNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Close Period", "إغلاق فترة")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "Are you sure you want to close period ${period}? After closing, no journal entries, invoices, or payments can be created in this period.",
              "هل أنت متأكد من إغلاق الفترة ${period}؟ بعد الإغلاق، لا يمكن إنشاء قيود أو فواتير أو مدفوعات في هذه الفترة.",
            ).replace("${period}", closeTarget?.period ?? "")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="close-notes">{t("Notes (optional)", "ملاحظات (اختياري)")}</Label>
            <Input
              id="close-notes"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder={t("Reason for closing", "سبب الإغلاق")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCloseTarget(null); setCloseNotes(""); }}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={handleClose} disabled={closing}>
              {t("Close Period", "إغلاق فترة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenOpen} onOpenChange={(open) => { if (!open) { setReopenTarget(null); setReopenOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Reopen Period", "فتح فترة")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "Are you sure you want to reopen period ${period}? This will allow creating entries in this period again.",
              "هل أنت متأكد من فتح الفترة ${period}؟ سيسمح هذا بإنشاء قيود في هذه الفترة مرة أخرى.",
            ).replace("${period}", reopenTarget?.period ?? "")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReopenTarget(null); setReopenOpen(false); }}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={handleReopen} disabled={closing}>
              {t("Reopen", "فتح")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
