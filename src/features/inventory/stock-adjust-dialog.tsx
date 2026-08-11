import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useT } from "@/shared/lib/i18n";

export interface StockAdjustRequest {
  delta: number;
  reason: string;
}

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: { productName: string; productSku: string; quantity: number } | null;
  onConfirm: (req: StockAdjustRequest) => void;
}

export function StockAdjustDialog({ open, onOpenChange, item, onConfirm }: StockAdjustDialogProps) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { t } = useT();

  if (!item) return null;

  const current = item.quantity;
  const adjusted = Math.max(0, current + delta);

  const handleConfirm = async () => {
    if (delta === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({ delta, reason: reason.trim() });
      setDelta(0);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Adjust stock", "تعديل المخزون")}</DialogTitle>
          <DialogDescription>
            {item.productName} <span className="text-muted-foreground">({item.productSku})</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-4">
          <Button type="button" variant="outline" size="icon" onClick={() => setDelta((d) => d - 1)}>
            <Minus className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-3xl font-semibold tabular-nums">{delta > 0 ? `+${delta}` : delta}</p>
            <p className="text-xs text-muted-foreground">{t("change", "التغيير")}</p>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => setDelta((d) => d + 1)}>
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("Current on hand", "المتوفر حالياً")}</span>
          <span className="tabular-nums">{current} {t("units", "وحدة")}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-accent/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("After adjustment", "بعد التعديل")}</span>
          <span className="font-medium tabular-nums">{adjusted} {t("units", "وحدة")}</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason">{t("Reason", "السبب")}</Label>
          <Input
            id="reason"
            placeholder={t("e.g. Damaged goods, cycle count, restock…", "مثال: بضاعة تالفة، جرد دوري، إعادة تزويد…")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t("Cancel", "إلغاء")}</Button>
          <Button onClick={handleConfirm} disabled={delta === 0 || submitting} loading={submitting}>
            {t("Apply adjustment", "تطبيق التعديل")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}