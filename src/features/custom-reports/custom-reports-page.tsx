import { useEffect, useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, Play, Pencil, Trash2 } from "lucide-react";
import { useCustomReportsStore } from "@/stores/custom-reports-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { customReportsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { CustomReport } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { Badge } from "@/shared/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";

const columnHelper = createColumnHelper<CustomReport>();

export function CustomReportsPage() {
  const { t } = useT();
  const canCreate = usePermission("reports.create");
  const simLoading = useSimulatedLoading(600);

  const items = useCustomReportsStore((s) => s.items);
  const hydrate = useCustomReportsStore((s) => s.hydrate);
  const addItem = useCustomReportsStore((s) => s.add);
  const updateItem = useCustomReportsStore((s) => s.update);
  const removeItem = useCustomReportsStore((s) => s.remove);

  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSource, setFormSource] = useState<CustomReport["dataSource"]>("sales");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await customReportsApi().list();
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
    setFormDesc("");
    setFormSource("sales");
    setDialogOpen(true);
  };

  const openEdit = (report: CustomReport) => {
    setEditingId(report.id);
    setFormName(report.name);
    setFormDesc(report.description ?? "");
    setFormSource(report.dataSource);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        const updated = await customReportsApi().update(editingId, {
          name: formName,
          description: formDesc,
          dataSource: formSource,
        });
        updateItem(editingId, updated);
        toast.success(t("Report updated", "تم تحديث التقرير"));
      } else {
        const created = await customReportsApi().create({
          name: formName,
          description: formDesc,
          dataSource: formSource,
          columns: [],
          filters: {},
          status: "draft",
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
      await customReportsApi().remove(id);
      removeItem(id);
      toast.success(t("Report deleted", "تم حذف التقرير"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to delete", "فشل الحذف"));
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await customReportsApi().execute(id);
      toast.success(t("Report executed", "تم تنفيذ التقرير"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to execute", "فشل التنفيذ"));
    }
  };

  const columns = useMemo<ColumnDef<CustomReport, any>[]>(
    () => [
      columnHelper.accessor("name", {
        header: t("Name", "الاسم"),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("dataSource", {
        header: t("Data Source", "مصدر البيانات"),
        cell: (info) => {
          const v = info.getValue();
          const labels: Record<string, string> = { sales: t("Sales", "المبيعات"), purchases: t("Purchases", "المشتريات"), inventory: t("Inventory", "المخزون"), accounting: t("Accounting", "المحاسبة") };
          return <Badge variant="outline">{labels[v] ?? v}</Badge>;
        },
      }),
      columnHelper.accessor("status", {
        header: t("Status", "الحالة"),
        cell: (info) => {
          const v = info.getValue();
          return <Badge variant={v === "active" ? "default" : "secondary"}>{v === "active" ? t("Active", "نشط") : t("Draft", "مسودة")}</Badge>;
        },
      }),
      columnHelper.accessor("createdAt", {
        header: t("Created", "أنشئ في"),
      }),
      columnHelper.display({
        id: "actions",
        header: t("Actions", "الإجراءات"),
        cell: (info) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => handleExecute(info.row.original.id)}>
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
        title={t("Custom Reports", "التقارير المخصصة")}
        description={t("Create and manage custom reports.", "إنشاء وإدارة التقارير المخصصة.")}
      >
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4 me-1" />
            {t("New Report", "تقرير جديد")}
          </Button>
        )}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {(simLoading || loading) ? (
          <div className="p-4"><SkeletonTable rows={6} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            emptyTitle={t("No reports", "لا توجد تقارير")}
            emptyDescription={t("Create a custom report to get started.", "أنشئ تقريراً مخصصاً للبدء.")}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("Edit Report", "تعديل التقرير") : t("New Report", "تقرير جديد")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Name", "الاسم")}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Description", "الوصف")}</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Data Source", "مصدر البيانات")}</Label>
              <Select value={formSource} onValueChange={(v) => setFormSource(v as CustomReport["dataSource"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">{t("Sales", "المبيعات")}</SelectItem>
                  <SelectItem value="purchases">{t("Purchases", "المشتريات")}</SelectItem>
                  <SelectItem value="inventory">{t("Inventory", "المخزون")}</SelectItem>
                  <SelectItem value="accounting">{t("Accounting", "المحاسبة")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel", "إلغاء")}</Button>
            <Button onClick={handleSave} disabled={!formName}>{t("Save", "حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
