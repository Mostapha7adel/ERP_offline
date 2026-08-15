import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Plus, Undo2 } from "lucide-react";
import { useNotesStore } from "@/stores/notes-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { notesApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { TradeNote } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { NoteFormDialog } from "./note-form-dialog";

const noteColumnHelper = createColumnHelper<TradeNote>();

export function NotesPage() {
  const { t } = useT();
  const notes = useNotesStore((s) => s.items);
  const canCreate = usePermission("notes.create");
  const canVoid = usePermission("notes.void");

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<TradeNote | null>(null);
  const [voiding, setVoiding] = useState(false);
  const loading = useSimulatedLoading(600);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.number, n.partyName ?? "", n.invoiceNumber ?? "", n.reason ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [notes, search]);

  const totals = useMemo(() => {
    const issued = notes.filter((n) => n.status === "issued");
    const credits = issued.filter((n) => n.noteType === "credit").reduce((s, n) => s + n.total, 0);
    const debits = issued.filter((n) => n.noteType === "debit").reduce((s, n) => s + n.total, 0);
    return { credits, debits };
  }, [notes]);

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const record = await notesApi().void(voidTarget.id);
      useNotesStore.getState().upsert(record);
      toast.success(t("${number} voided", "تم إلغاء ${number}").replace("${number}", voidTarget.number));
      setVoidTarget(null);
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Credit & Debit Notes", "الإشعارات الدائنة والمدينة")}
        description={t("Adjust invoices and stock with credit or debit notes.", "اضبط الفواتير والمخزون من خلال إشعارات دائنة أو مدينة.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("New note", "إشعار جديد")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Issued credit notes", "الإشعارات الدائنة الصادرة")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{formatCurrency(totals.credits)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("Issued debit notes", "الإشعارات المدينة الصادرة")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{formatCurrency(totals.debits)}</p>
        </Card>
      </div>

      <Card>
        <Tabs defaultValue="all">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-3">
            <TabsList>
              <TabsTrigger value="all">{t("All", "الكل")}</TabsTrigger>
              <TabsTrigger value="sales">{t("Sales", "المبيعات")}</TabsTrigger>
              <TabsTrigger value="purchase">{t("Purchases", "المشتريات")}</TabsTrigger>
            </TabsList>
            <SearchInput
              placeholder={t("Search notes…", "البحث في الإشعارات…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              className="w-full sm:w-64"
            />
          </div>
          <TabsContent value="all" className="mt-0 p-4">
            {loading ? (
              <SkeletonTable rows={8} columns={5} />
            ) : (
              <DataTable
                columns={buildNoteColumns(t, canVoid, setVoidTarget)}
                data={filtered}
                pagination
                pageSize={10}
                emptyTitle={t("No notes yet", "لا توجد إشعارات بعد")}
                emptyDescription={t("Create a credit or debit note to adjust an invoice.", "أنشئ إشعاراً دائناً أو مديناً لضبط فاتورة.")}
              />
            )}
          </TabsContent>
          <TabsContent value="sales" className="mt-0 p-4">
            {loading ? (
              <SkeletonTable rows={8} columns={5} />
            ) : (
              <DataTable
                columns={buildNoteColumns(t, canVoid, setVoidTarget)}
                data={filtered.filter((n) => n.type === "sales")}
                pagination
                pageSize={10}
                emptyTitle={t("No sales notes", "لا توجد إشعارات مبيعات")}
                emptyDescription={t("Sales credit and debit notes will appear here.", "ستظهر هنا إشعارات المبيعات الدائنة والمدينة.")}
              />
            )}
          </TabsContent>
          <TabsContent value="purchase" className="mt-0 p-4">
            {loading ? (
              <SkeletonTable rows={8} columns={5} />
            ) : (
              <DataTable
                columns={buildNoteColumns(t, canVoid, setVoidTarget)}
                data={filtered.filter((n) => n.type === "purchase")}
                pagination
                pageSize={10}
                emptyTitle={t("No purchase notes", "لا توجد إشعارات مشتريات")}
                emptyDescription={t("Purchase credit and debit notes will appear here.", "ستظهر هنا إشعارات المشتريات الدائنة والمدينة.")}
              />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <NoteFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={(note) => useNotesStore.getState().add(note)}
      />

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        title={t("Void this note?", "إلغاء هذا الإشعار؟")}
        description={t(
          "Voiding reverses the stock movement and restores the linked invoice total. This cannot be undone.",
          "إلغاء الإشعار يعكس حركة المخزون ويعيد إجمالي الفاتورة المرتبطة. لا يمكن التراجع عن هذا الإجراء.",
        )}
        confirmLabel={t("Void note", "إلغاء الإشعار")}
        loading={voiding}
        onConfirm={() => void handleVoid()}
      />
    </div>
  );
}

function buildNoteColumns(
  t: TranslateFn,
  canVoid: boolean,
  onVoid: (note: TradeNote) => void,
): ColumnDef<TradeNote, any>[] {
  return [
    noteColumnHelper.accessor("number", { header: t("Number", "الرقم"), cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span> }),
    noteColumnHelper.accessor("noteType", {
      header: t("Type", "النوع"),
      cell: (info) => {
        const credit = info.getValue() === "credit";
        return (
          <Badge variant={credit ? "success" : "destructive"} className="capitalize">
            {credit ? t("Credit", "دائن") : t("Debit", "مدين")}
          </Badge>
        );
      },
    }),
    noteColumnHelper.accessor("partyName", {
      header: t("Party", "الطرف"),
      cell: (info) => <span className="font-medium">{info.getValue() ?? "—"}</span>,
    }),
    noteColumnHelper.accessor("invoiceNumber", {
      header: t("Invoice", "الفاتورة"),
      cell: (info) => <span className="font-mono text-xs text-muted-foreground">{info.getValue() ?? "—"}</span>,
    }),
    noteColumnHelper.accessor("noteDate", {
      header: t("Date", "التاريخ"),
      cell: (info) => <span className="tabular-nums text-sm">{formatDate(String(info.getValue()))}</span>,
    }),
    noteColumnHelper.accessor("total", {
      header: t("Total", "الإجمالي"),
      cell: (info) => <span className="tabular-nums font-medium">{formatCurrency(Number(info.getValue()))}</span>,
    }),
    noteColumnHelper.accessor("status", {
      header: t("Status", "الحالة"),
      cell: (info) => {
        const issued = info.getValue() === "issued";
        return <Badge variant={issued ? "success" : "muted"} dot className="capitalize">{issued ? t("Issued", "صادر") : t("Void", "ملغى")}</Badge>;
      },
    }),
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const note = row.original;
        if (note.status !== "issued" || !canVoid) return null;
        return (
          <Button variant="ghost" size="icon" title={t("Void", "إلغاء")} onClick={() => onVoid(note)}>
            <Undo2 className="size-4" />
          </Button>
        );
      },
    },
  ];
}
