import { useEffect, useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, Play, Pencil, Trash2 } from "lucide-react";
import { useScheduledReportsStore } from "@/stores/scheduled-reports-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { scheduledReportsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { ScheduledReport, ScheduledReportFrequency } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { Badge } from "@/shared/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";

const columnHelper = createColumnHelper<ScheduledReport>();

export function ScheduledReportsPage() {
  const { t } = useT();
  const canCreate = usePermission("reports.create");
  const simLoading = useSimulatedLoading(600);

  const items = useScheduledReportsStore((s) => s.items);
  const hydrate = useScheduledReportsStore((s) => s.hydrate);
  const addItem = useScheduledReportsStore((s) => s.add);
  const updateItem = useScheduledReportsStore((s) => s.update);
  const removeItem = useScheduledReportsStore((s) => s.remove);

  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formReportType, setFormReportType] = useState("");
  const [formFrequency, setFormFrequency] = useState<ScheduledReportFrequency>("daily");
  const [formRecipients, setFormRecipients] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await scheduledReportsApi().list();
        hydrate(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hydrate]);

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormReportType("");
    setFormFrequency("daily");
    setFormRecipients("");
    setDialogOpen(true);
  };

  const openEdit = (report: ScheduledReport) => {
    setEditingId(report.id);
    setFormName(report.name);
    setFormReportType(report.reportType);
    setFormFrequency(report.frequency);
    setFormRecipients(report.recipients.join(", "));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const recipients = formRecipients.split(",").map((r) => r.trim()).filter(Boolean);
      const nextRun = new Date().toISOString();
      if (editingId) {
        const updated = await scheduledReportsApi().update(editingId, {
          name: formName,
          reportType: formReportType,
          frequency: formFrequency,
          recipients,
        });
        updateItem(editingId, updated);
        toast.success(t("Report updated", "تم تحديث التقرير"));
      } else {
        const created = await scheduledReportsApi().create({
          name: formName,
          reportType: formReportType,
          frequency: formFrequency,
          nextRunDate: nextRun,
          recipients,
          status: "active",
        });
        addItem(created);
        toast.success(t("Report created", "تم إنشاء التقرير"));
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save", "فشل الحفظ"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await scheduledReportsApi().remove(id);
      removeItem(id);
      toast.success(t("Report deleted", "تم حذف التقرير"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to delete", "فشل الحذف"));
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await scheduledReportsApi().runNow(id);
      toast.success(t("Report executed", "تم تنفيذ التقرير"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to execute", "فشل التنفيذ"));
    }
  };

  const frequencyLabels: Record<ScheduledReportFrequency, string> = {
    daily: t("Daily", "يومي"),
    weekly: t("Weekly", "أسبوعي"),
    monthly: t("Monthly", "شهري"),
    quarterly: t("Quarterly", "ربع سنوي"),
  };

  const columns = useMemo<ColumnDef<ScheduledReport, any>[]>(
    () => [
      columnHelper.accessor("name", {
        header: t("Name", "الاسم"),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("reportType", {
        header: t("Report Type", "نوع التقرير"),
      }),
      columnHelper.accessor("frequency", {
        header: t("Frequency", "التكرار"),
        cell: (info) => <Badge variant="outline">{frequencyLabels[info.getValue() as ScheduledReportFrequency]}</Badge>,
      }),
      columnHelper.accessor("status", {
        header: t("Status", "الحالة"),
        cell: (info) => {
          const v = info.getValue();
          return <Badge variant={v === "active" ? "default" : "secondary"}>{v === "active" ? t("Active", "نشط") : t("Paused", "متوقف")}</Badge>;
        },
      }),
      columnHelper.accessor("nextRunDate", {
        header: t("Next Run", "التشغيل التالي"),
      }),
      columnHelper.display({
        id: "actions",
        header: t("Actions", "الإجراءات"),
        cell: (info) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => handleRunNow(info.row.original.id)}>
              <Play className="size-3.5" />
            </Button>
            {canCreate && (
              <>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(info.row.original)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDelete(info.row.original.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        ),
      }),
    ],
    [t, canCreate],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Scheduled Reports", "التقارير المجدولة")}
        description={t("Automate report generation and distribution.", "أتمتة إنشاء التقارير وتوزيعها.")}
      >
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4 me-1" />
            {t("New Schedule", "جدولة جديدة")}
          </Button>
        )}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {(simLoading || loading) ? (
          <div className="p-4"><SkeletonTable rows={6} columns={6} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            emptyTitle={t("No scheduled reports", "لا توجد تقارير مجدولة")}
            emptyDescription={t("Schedule a report to automate distribution.", "جدول تقريراً لأتمتة التوزيع.")}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("Edit Schedule", "تعديل الجدولة") : t("New Schedule", "جدولة جديدة")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Name", "الاسم")}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Report Type", "نوع التقرير")}</Label>
              <Input value={formReportType} onChange={(e) => setFormReportType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Frequency", "التكرار")}</Label>
              <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v as ScheduledReportFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t("Daily", "يومي")}</SelectItem>
                  <SelectItem value="weekly">{t("Weekly", "أسبوعي")}</SelectItem>
                  <SelectItem value="monthly">{t("Monthly", "شهري")}</SelectItem>
                  <SelectItem value="quarterly">{t("Quarterly", "ربع سنوي")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Recipients (comma separated)", "المستلمون (مفصولة بفواصل)")}</Label>
              <Input value={formRecipients} onChange={(e) => setFormRecipients(e.target.value)} placeholder="email1@example.com, email2@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel", "إلغاء")}</Button>
            <Button onClick={handleSave} disabled={!formName || !formReportType}>{t("Save", "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
