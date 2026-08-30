import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, ShieldCheck,
} from "lucide-react";
import { useWarrantiesStore } from "@/stores/warranties-store";
import { useProductsStore } from "@/stores/products-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatDate } from "@/lib/format";
import { warrantiesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { Warranty } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const columnHelper = createColumnHelper<Warranty>();

const STATUS_LABELS: Record<string, { en: string; ar: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { en: "Active", ar: "نشط", variant: "default" },
  expired: { en: "Expired", ar: "منتهي", variant: "secondary" },
  claimed: { en: "Claimed", ar: "المطالبة", variant: "destructive" },
};

function buildColumns(h: {
  onClaim: (w: Warranty) => void;
  canClaim: boolean;
  t: TranslateFn;
}): ColumnDef<Warranty, any>[] {
  return [
    columnHelper.accessor("productName", {
      header: h.t("Product", "المنتج"),
      cell: (info) => {
        const w = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? w.productId}</p>
              {w.serialNumber && <p className="text-xs text-muted-foreground">{w.serialNumber}</p>}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("customerName", {
      header: h.t("Customer", "العميل"),
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("startDate", {
      header: h.t("Start Date", "تاريخ البداية"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("endDate", {
      header: h.t("End Date", "تاريخ النهاية"),
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => {
        const status = info.getValue();
        const label = STATUS_LABELS[status] ?? { en: status, ar: status, variant: "outline" as const };
        return <Badge variant={label.variant}>{h.t(label.en, label.ar)}</Badge>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const w = info.row.original;
        return h.canClaim && w.status === "active" ? (
          <Button variant="outline" size="sm" onClick={() => h.onClaim(w)}>
            {h.t("Claim", "المطالبة")}
          </Button>
        ) : null;
      },
    }),
  ];
}

export function WarrantiesPage() {
  const items = useWarrantiesStore((s) => s.items);
  const add = useWarrantiesStore((s) => s.add);
  const update = useWarrantiesStore((s) => s.update);
  const products = useProductsStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState<Warranty | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = usePermission("warranties.create");
  const canClaim = usePermission("warranties.claim");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) =>
      [w.productName ?? "", w.customerName ?? "", w.serialNumber ?? "", w.status]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  const handleCreate = async (data: Omit<Warranty, "id" | "createdAt" | "status">) => {
    setBusy(true);
    try {
      const created = await warrantiesApi().create(data);
      add(created);
      toast.success(t("Warranty created", "تم إنشاء الضمان"));
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async (claimNotes: string) => {
    if (!claimOpen) return;
    setBusy(true);
    try {
      const claimed = await warrantiesApi().claim({ warrantyId: claimOpen.id, claimNotes });
      update(claimOpen.id, claimed);
      toast.success(t("Warranty claimed", "تم المطالبة بالضمان"));
      setClaimOpen(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<Warranty, any>[]>(
    () => buildColumns({ onClaim: setClaimOpen, canClaim, t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canClaim, t, items],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Warranties", "الضمانات")}
        description={t("Track product warranties and claims.", "تتبع ضمانات المنتجات والمطالبات.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("New warranty", "ضمان جديد")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={6} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search warranties…", "ابحث عن ضمانات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("warranties", "ضمان")}</div>
              </div>
            }
            emptyTitle={t("No warranties", "لا توجد ضمانات")}
            emptyDescription={t("Create warranties to track product coverage.", "إنشاء ضمانات لتتبع تغطية المنتجات.")}
          />
        )}
      </div>

      <WarrantyFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        onSave={handleCreate}
        busy={busy}
      />

      <ClaimDialog
        open={claimOpen !== null}
        onOpenChange={(open) => { if (!open) setClaimOpen(null); }}
        onSave={handleClaim}
        busy={busy}
      />
    </div>
  );
}

function WarrantyFormDialog({
  open,
  onOpenChange,
  products,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Array<{ id: string; name: string }>;
  onSave: (data: Omit<Warranty, "id" | "createdAt" | "status">) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [terms, setTerms] = useState("");

  const handleSave = () => {
    onSave({ productId, customerId, customerName, serialNumber, startDate, endDate, terms });
    setProductId("");
    setCustomerId("");
    setCustomerName("");
    setSerialNumber("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setTerms("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("New Warranty", "ضمان جديد")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>{t("Product", "المنتج")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{t("Select product…", "اختر منتجاً…")}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Customer ID", "رقم العميل")}</Label>
              <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Customer Name", "اسم العميل")}</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Serial Number", "الرقم التسلسلي")}</Label>
            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder={t("Optional", "اختياري")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Start Date", "تاريخ البداية")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("End Date", "تاريخ النهاية")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("Terms", "الشروط")}</Label>
            <Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t("Warranty terms…", "شروط الضمان…")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} loading={busy} disabled={!productId || !customerId || !endDate}>
            {t("Create", "إنشاء")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimDialog({
  open,
  onOpenChange,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (claimNotes: string) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [claimNotes, setClaimNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Claim Warranty", "المطالبة بالضمان")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Claim Notes", "ملاحظات المطالبة")}</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              placeholder={t("Describe the issue…", "اوصف المشكلة…")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={() => onSave(claimNotes)} loading={busy} disabled={!claimNotes.trim()}>
            {t("Submit Claim", "إرسال المطالبة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
