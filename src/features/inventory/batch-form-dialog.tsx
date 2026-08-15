import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Combobox } from "@/shared/components/forms/combobox";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { useT } from "@/shared/lib/i18n";
import { inventoryApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { Product } from "@/types/domain";

interface WarehouseLike {
  id: string;
  name: string;
  code: string;
}

interface BatchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  warehouses: WarehouseLike[];
  onSaved: () => void;
}

export function BatchFormDialog({ open, onOpenChange, products, warehouses, onSaved }: BatchFormDialogProps) {
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useT();

  if (!open) return null;

  const productOptions = products.map((p) => ({
    value: p.id,
    label: p.name,
    meta: p.barcode || p.sku,
  }));
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name, meta: w.code }));
  const canSubmit = productId && warehouseId && batchNumber.trim() && quantity > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await inventoryApi().recordBatch({
        productId,
        warehouseId,
        batchNumber: batchNumber.trim(),
        quantity: Number(quantity),
        expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
      });
      setProductId("");
      setWarehouseId("");
      setBatchNumber("");
      setQuantity(1);
      setExpiryDate(undefined);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Record batch / lot", "تسجيل دفعة / لوت")}</DialogTitle>
          <DialogDescription>
            {t("Add a received batch with an optional expiry date for expiry tracking.", "أضف دفعة مستلمة مع تاريخ انتهاء صلاحية اختياري لتتبع الصلاحية.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Product *", "المنتج *")}</Label>
            <Combobox
              options={productOptions}
              value={productId}
              onValueChange={setProductId}
              placeholder={t("Select a product…", "اختر منتجاً…")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("Warehouse *", "المستودع *")}</Label>
            <Combobox
              options={warehouseOptions}
              value={warehouseId}
              onValueChange={setWarehouseId}
              placeholder={t("Select a warehouse…", "اختر مستودعاً…")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("Batch / Lot # *", "رقم الدفعة / اللوت *")}</Label>
              <Input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder={t("e.g. LOT-2026-01", "مثال: LOT-2026-01")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Quantity *", "الكمية *")}</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("Expiry date", "تاريخ انتهاء الصلاحية")}</Label>
            <DatePicker value={expiryDate} onValueChange={(d) => setExpiryDate(d ?? undefined)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting}>
            <PackagePlus className="size-4" />
            {t("Save batch", "حفظ الدفعة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
