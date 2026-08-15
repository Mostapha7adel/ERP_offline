import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Package, Plus, Pencil, Trash2, MoreHorizontal, Eye } from "lucide-react";
import { useProductsStore } from "@/stores/products-store";
import { useInventoryStore } from "@/stores/inventory-store";
import { usePermission } from "@/shared/components/permission-gate";
import { useSimulatedLoading } from "@/shared/lib/use-simulated-loading";
import { useT } from "@/shared/lib/i18n";
import type { TranslateFn } from "@/shared/lib/i18n";
import { formatCurrency, padNumber } from "@/lib/format";
import { productsApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import type { Product } from "@/types/domain";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table/data-table";
import { SearchInput } from "@/shared/components/forms/search-input";
import { SkeletonTable } from "@/shared/components/feedback/skeletons";
import { ProductDetailDrawer } from "./product-detail-drawer";
import { ProductFormDialog } from "./product-form-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/shared/components/feedback/confirm-dialog";

const columnHelper = createColumnHelper<Product>();

function stockCount(stock: { productId: string; quantity: number }[], id: string) {
  return stock.filter((s) => s.productId === id).reduce((sum, s) => sum + s.quantity, 0);
}

interface Handlers {
  onView: (p: Product) => void;
  onEdit: (p: Product) => void;
  onRemove: (p: Product) => void;
  onToggle: (p: Product) => void;
  canManage: boolean;
  stockOf: (id: string) => number;
  t: TranslateFn;
}

function buildColumns(h: Handlers): ColumnDef<Product, any>[] {
  return [
    columnHelper.accessor("name", {
      header: h.t("Product", "المنتج"),
      cell: (info) => {
        const p = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-4" />
            </div>
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku}
                {p.barcode ? <span className="ms-1 font-mono text-muted-foreground/70">· {p.barcode}</span> : null}
              </p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("category", { header: h.t("Category", "الفئة"), cell: (info) => info.getValue() }),
    columnHelper.accessor("costPrice", {
      header: h.t("Cost", "التكلفة"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor("salePrice", {
      header: h.t("Price", "السعر"),
      cell: (info) => <span className="tabular-nums">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: "stock",
      header: h.t("On hand", "المتوفر"),
      cell: (info) => {
        const count = h.stockOf(info.row.original.id);
        const reorder = info.row.original.reorderLevel;
        return (
          <span className={`tabular-nums ${count <= reorder ? "text-destructive" : ""}`}>
            {count} {h.t("units", "وحدة")}
          </span>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: h.t("Status", "الحالة"),
      cell: (info) => (
        <Badge variant={info.getValue() === "active" ? "success" : "muted"} dot>
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const p = info.row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={h.t("Actions", "إجراءات")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => h.onView(p)}>
                <Eye className="size-4" /> {h.t("View", "عرض")}
              </DropdownMenuItem>
              {h.canManage ? (
                <>
                  <DropdownMenuItem onClick={() => h.onEdit(p)}>
                    <Pencil className="size-4" /> {h.t("Edit", "تعديل")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => h.onToggle(p)}
                    className="text-warning focus:text-warning"
                  >
                    {p.status === "active" ? h.t("Deactivate", "إلغاء التنشيط") : h.t("Activate", "تنشيط")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => h.onRemove(p)} className="text-destructive focus:text-destructive">
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

export function ProductsPage() {
  const items = useProductsStore((s) => s.items);
  const add = useProductsStore((s) => s.add);
  const update = useProductsStore((s) => s.update);
  const remove = useProductsStore((s) => s.remove);
  const stock = useInventoryStore((s) => s.items);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const canCreate = usePermission("products.create");
  const canUpdate = usePermission("products.update");
  const loading = useSimulatedLoading(600, [search]);
  const { t } = useT();

  const categories = useMemo(
    () => [...new Set([...items.map((p) => p.category), "General"])],
    [items],
  );

  const nextSku = useMemo(() => {
    const maxNum = items.reduce((acc, p) => {
      const m = p.sku.match(/PRD-(\d+)/);
      const num = m && m[1] ? parseInt(m[1], 10) : 0;
      return num > acc ? num : acc;
    }, 0);
    return `PRD-${padNumber(maxNum + 1, 3)}`;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => [p.name, p.sku, p.category, p.barcode ?? ""].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const handleSave = (product: Product) => {
    if (items.some((p) => p.id === product.id)) update(product.id, product);
    else add(product);
  };

  const confirmDelete = async () => {
    if (deleting) {
      setDeletingBusy(true);
      try {
        await productsApi().remove(deleting.id);
        remove(deleting.id);
        toast.success(t("${name} deleted", "تم حذف ${name}").replace("${name}", deleting.name));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("Delete failed", "فشل الحذف"));
      } finally {
        setDeletingBusy(false);
      }
    }
    setDeleting(null);
    setConfirmOpen(false);
  };

  const toggleStatus = async (p: Product) => {
    const next = p.status === "active" ? "draft" : "active";
    try {
      const updated = await productsApi().update(p.id, { status: next });
      update(updated.id, updated);
      toast.success(
        `${updated.name} ${
          next === "active" ? t("activated", "تم تنشيطه") : t("deactivated", "تم إلغاء تنشيطه")
        }`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Update failed", "فشل التحديث"));
    }
  };

  const columns = useMemo<ColumnDef<Product, any>[]>(
    () =>
      buildColumns({
        onView: setDetail,
        onEdit: setEditing,
        onRemove: (p) => { setDeleting(p); setConfirmOpen(true); },
        onToggle: toggleStatus,
        canManage: canUpdate,
        stockOf: (id) => stockCount(stock, id),
        t,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, stock, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Products", "المنتجات")}
        description={t("Manage your product catalog, pricing and availability.", "إدارة كتالوج منتجاتك وأسعارها ومدى توفرها.")}
      >
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("Add product", "إضافة منتج")}
          </Button>
        ) : null}
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} columns={5} /></div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => setDetail(row)}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <SearchInput
                  placeholder={t("Search products…", "ابحث عن المنتجات…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch("")}
                  className="w-full sm:w-72"
                />
                <div className="ms-auto text-sm text-muted-foreground">
                  {filtered.length} {t("products", "منتجاً")}
                </div>
              </div>
            }
            emptyTitle={t("No products yet", "لا توجد منتجات بعد")}
            emptyDescription={t("Add your first product to start tracking inventory.", "أضف منتجك الأول لبدء تتبع المخزون.")}
          />
        )}
      </div>

      <ProductFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditing(null); } }}
        product={editing}
        onSave={handleSave}
        categories={categories}
        nextSku={nextSku}
      />

      <ProductDetailDrawer
        product={detail}
        stockOf={(id) => stockCount(stock, id)}
        onOpenChange={() => setDetail(null)}
        onEdit={() => { setEditing(detail); setDetail(null); }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("Delete ${name}?", "حذف ${name}؟").replace("${name}", deleting?.name ?? t("product", "المنتج"))}
        description={t("This permanently removes the product from your catalog.", "سيؤدي هذا إلى حذف المنتج نهائياً من الكتالوج.")}
        confirmLabel={t("Delete", "حذف")}
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}