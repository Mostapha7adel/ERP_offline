import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { useT } from "@/shared/lib/i18n";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types/domain";

interface ProductDetailDrawerProps {
  product: Product | null;
  stockOf: (id: string) => number;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export function ProductDetailDrawer({ product, stockOf, onOpenChange, onEdit }: ProductDetailDrawerProps) {
  const { t } = useT();
  if (!product) return null;
  const onHand = stockOf(product.id);
  const margin = product.costPrice > 0 ? ((product.salePrice - product.costPrice) / product.costPrice) * 100 : 0;
  const lowStock = onHand <= product.reorderLevel;

  return (
    <Sheet open={Boolean(product)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span>{product.sku}</span>
            <Badge variant={product.status === "active" ? "success" : "muted"} dot>
              {product.status}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <Button size="sm" variant="outline" onClick={onEdit} className="w-fit">
            {t("Edit product", "تعديل المنتج")}
          </Button>

          <div className="grid grid-cols-3 gap-3">
            <Stat label={t("On hand", "المتوفر")} value={`${onHand}`} danger={lowStock} />
            <Stat label={t("Cost", "التكلفة")} value={formatCurrency(product.costPrice)} />
            <Stat label={t("Price", "السعر")} value={formatCurrency(product.salePrice)} />
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("Gross margin", "هامش الربح الإجمالي")}</span>
              <span className="text-sm font-semibold">{margin.toFixed(1)}%</span>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Details", "التفاصيل")}</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label={t("Category", "الفئة")} value={product.category} />
              <Detail label={t("Unit", "الوحدة")} value={product.unit} />
              <Detail label={t("Tax rate", "نسبة الضريبة")} value={`${product.taxRate}%`} />
              <Detail label={t("Reorder level", "مستوى إعادة الطلب")} value={`${product.reorderLevel} ${t("units", "وحدة")}`} />
            </dl>
          </div>

          {lowStock ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {t("Low on stock — consider reordering.", "المخزون منخفض — فكر في إعادة الطلب.")}
            </div>
          ) : null}

          {product.description ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Description", "الوصف")}</h4>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}