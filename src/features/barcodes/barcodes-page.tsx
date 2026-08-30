import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Plus, MoreHorizontal, Trash2, Barcode, Printer,
} from "lucide-react";
import { useProductsStore } from "@/stores/products-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import { barcodeApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { BarcodeEntry } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

const columnHelper = createColumnHelper<BarcodeEntry>();

function buildColumns(h: {
  onRemove: (b: BarcodeEntry) => void;
  onPrint: (b: BarcodeEntry) => void;
  canManage: boolean;
  t: ReturnType<typeof useT>["t"];
}): ColumnDef<BarcodeEntry, any>[] {
  return [
    columnHelper.accessor("productName", {
      header: h.t("Product", "المنتج"),
      cell: (info) => {
        const b = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Barcode className="size-4" />
            </div>
            <div>
              <p className="font-medium">{info.getValue() ?? b.productId}</p>
              <p className="text-xs text-muted-foreground">{b.sku}</p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("barcode", {
      header: h.t("Barcode", "الباركود"),
      cell: (info) => (
        <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono">{info.getValue()}</code>
      ),
    }),
    columnHelper.accessor("format", {
      header: h.t("Format", "الصيغة"),
      cell: (info) => (
        <Badge variant="outline">{info.getValue().toUpperCase()}</Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const b = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onPrint(b)}>
                <Printer className="size-4" /> {h.t("Print barcode", "طباعة الباركود")}
              </DropdownMenuItem>
              {h.canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onRemove(b)} className="text-destructive focus:text-destructive">
                    <Trash2 className="size-4" /> {h.t("Delete", "حذف")}
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

export function BarcodesPage() {
  const products = useProductsStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<BarcodeEntry[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState<"upc-a" | "ean-13" | "code-128" | "qr">("ean-13");
  const [customBarcode, setCustomBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<BarcodeEntry | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [printPreview, setPrintPreview] = useState<BarcodeEntry | null>(null);

  const canCreate = usePermission("barcodes.create");
  const canManage = usePermission("barcodes.delete");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const productsWithBarcode = useMemo(() => {
    const barcodeIds = new Set(entries.map((e) => e.productId));
    return products.filter((p) => p.barcode || barcodeIds.has(p.id));
  }, [products, entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = entries.length > 0 ? entries : productsWithBarcode.map((p) => ({
      id: p.id,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      barcode: p.barcode ?? "",
      format: "ean-13" as const,
      createdAt: p.createdAt,
    }));
    if (!q) return all;
    return all.filter((b) =>
      [b.productName ?? "", b.sku ?? "", b.barcode].join(" ").toLowerCase().includes(q),
    );
  }, [entries, productsWithBarcode, search]);

  const handleGenerate = async () => {
    if (!selectedProductId) return;
    setBusy(true);
    try {
      const entry = await barcodeApi().generate({
        productId: selectedProductId,
        format: barcodeFormat,
        barcode: customBarcode || undefined,
      });
      setEntries((prev) => [...prev, entry]);
      toast.success(t("Barcode generated", "تم إنشاء الباركود"));
      setGenerateOpen(false);
      setSelectedProductId("");
      setCustomBarcode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed", "فشل"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await barcodeApi().remove(deleting.id);
        setEntries((prev) => prev.filter((e) => e.id !== deleting.id));
        toast.success(t("Barcode deleted", "تم حذف الباركود"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const columns = useMemo<ColumnDef<BarcodeEntry, any>[]>(
    () =>
      buildColumns({
        onRemove: (b) => { setDeleting(b); setConfirmOpen(true); },
        onPrint: setPrintPreview,
        canManage,
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, t, entries, products],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Barcode Management", "إدارة الباركود")}
        description={t("Generate and manage barcodes for products.", "إنشاء وإدارة باركود للمنتجات.")}
      >
        {canCreate ? (
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="size-4" />
            {t("Generate barcode", "إنشاء باركود")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={6} columns={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search barcodes…", "ابحث عن باركود…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">{filtered.length} {t("barcodes", "باركود")}</div>
              </div>
            }
            emptyTitle={t("No barcodes", "لا توجد باركود")}
            emptyDescription={t("Generate barcodes for your products to enable scanning.", "إنشاء باركود لمنتجاتك لتمكين المسح.")}
          />
        )}
      </div>

      <Dialog open={generateOpen} onOpenChange={(open) => { if (!open) setGenerateOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Generate Barcode", "إنشاء باركود")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Product", "المنتج")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">{t("Select product…", "اختر منتجاً…")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Format", "الصيغة")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value as typeof barcodeFormat)}
              >
                <option value="ean-13">EAN-13</option>
                <option value="upc-a">UPC-A</option>
                <option value="code-128">Code 128</option>
                <option value="qr">QR Code</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Custom Barcode (optional)", "باركود مخصص (اختياري)")}</Label>
              <Input
                value={customBarcode}
                onChange={(e) => setCustomBarcode(e.target.value)}
                placeholder={t("Leave empty to auto-generate", "اتركه فارغاً للإنشاء التلقائي")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>{t("Cancel", "إلغاء")}</Button>
            <Button onClick={handleGenerate} loading={busy} disabled={!selectedProductId}>
              <Barcode className="size-4" />
              {t("Generate", "إنشاء")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printPreview !== null} onOpenChange={(open) => { if (!open) setPrintPreview(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Print Preview", "معاينة الطباعة")}</DialogTitle>
          </DialogHeader>
          {printPreview && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-lg border-2 border-dashed p-6 text-center">
                <div className="mb-2 font-mono text-2xl font-bold tracking-widest">
                  ||| {printPreview.barcode} |||
                </div>
                <p className="text-sm text-muted-foreground">{printPreview.productName}</p>
                <p className="text-xs text-muted-foreground">{printPreview.sku}</p>
              </div>
              <Badge variant="outline">{printPreview.format.toUpperCase()}</Badge>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintPreview(null)}>
              {t("Close", "إغلاق")}
            </Button>
            <Button onClick={() => { window.print(); setPrintPreview(null); }}>
              <Printer className="size-4" />
              {t("Print", "طباعة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete barcode?", "حذف الباركود؟")}
        description={t("This will permanently remove this barcode.", "سيؤدي هذا إلى حذف الباركود نهائياً.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
