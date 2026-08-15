import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";
import { uuid } from "@/lib/utils";
import { quotesApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { Quote, InvoiceKind, QuoteLine } from "@/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";
import { Combobox } from "@/shared/components/forms/combobox";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { CurrencyInput } from "@/shared/components/forms/currency-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";

const formSchema = z.object({
  partyId: z.string().min(1, "Select a party"),
  warehouseId: z.string().optional(),
  quoteDate: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  discount: z.coerce.number().min(0).default(0),
});

const defaultLine = (): QuoteLine => ({
  id: uuid("ln"),
  productId: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
  lineTotal: 0,
});

interface QuoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InvoiceKind;
  quote?: Quote | null;
  parties: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; salePrice: number; costPrice: number }[];
  warehouses: { id: string; name: string; code: string }[];
  onSave: (quote: Quote) => void;
}

type FormValues = z.infer<typeof formSchema>;

export function QuoteFormDialog({
  open,
  onOpenChange,
  kind,
  quote,
  parties,
  products,
  warehouses,
  onSave,
}: QuoteFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(quote);
  const [lines, setLines] = useState<QuoteLine[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { quoteDate: new Date(), discount: 0 },
  });

  useEffect(() => {
    if (!open) return;
    if (quote) {
      setLines(quote.lines.map((l) => ({ ...l })));
      form.reset({
        partyId: quote.partyId,
        warehouseId: quote.warehouseId ?? "",
        quoteDate: new Date(quote.quoteDate),
        validUntil: quote.validUntil ? new Date(quote.validUntil) : undefined,
        discount:
          quote.subtotal > 0
            ? Math.round((quote.discount / quote.subtotal) * 10000) / 100
            : 0,
      });
      return;
    }
    setLines([defaultLine()]);
    form.reset({
      partyId: "",
      warehouseId: "",
      quoteDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 86400000),
      discount: 0,
    });
  }, [open, kind, quote, form]);

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p.id, label: p.name })),
    [parties],
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
    [warehouses],
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.sku})`,
      })),
    [products],
  );

  const applyProduct = (lineId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const unitPrice = kind === "sale" ? product.salePrice : product.costPrice;
        return {
          ...line,
          productId: product.id,
          description: product.name,
          unitPrice,
          lineTotal: Math.round(line.quantity * unitPrice * 100) / 100,
        };
      }),
    );
  };

  const updateLine = (lineId: string, patch: Partial<QuoteLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        next.lineTotal = Math.round(next.quantity * next.unitPrice * 100) / 100;
        return next;
      }),
    );
  };

  const lineIsFilled = (l: QuoteLine) =>
    Boolean(l.productId?.trim() || l.description?.trim());
  const canSubmit = lines.some(lineIsFilled) && !lines.some((l) => !lineIsFilled(l));

  const { subtotal, discountAmount, total } = useMemo(() => {
    const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
    const discountPct = Number(form.watch("discount")) || 0;
    const discountAmount = round((subtotal * discountPct) / 100);
    return { subtotal, discountAmount, total: round(subtotal - discountAmount) };
  }, [lines, form]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        partyId: values.partyId,
        quoteDate: values.quoteDate.toISOString(),
        validUntil: values.validUntil?.toISOString(),
        warehouseId: values.warehouseId || undefined,
        discount: round(discountAmount),
        lines: lines.map((l) => {
          const product = l.productId ? products.find((p) => p.id === l.productId) : undefined;
          return {
            productId: product?.id,
            productName: product?.name ?? l.description ?? "",
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            discount: l.discount,
          };
        }),
      };
      const record =
        isEdit && quote
          ? await quotesApi().update(kind, quote.id, payload)
          : await quotesApi().create(kind, {
              type: kind === "sale" ? "sales" : "purchase",
              ...payload,
            });
      onSave(record);
      onOpenChange(false);
      toast.success(
        t("${number} saved", "تم حفظ ${number}").replace(
          "${number}",
          `${t("Quote", "عرض السعر")} ${record.number}`,
        ),
      );
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t(kind === "sale" ? "Edit sales quote" : "Edit purchase quotation", kind === "sale" ? "تعديل عرض سعر مبيعات" : "تعديل عرض سعر مشتريات")
              : t(kind === "sale" ? "New sales quote" : "New purchase quotation", kind === "sale" ? "عرض سعر مبيعات جديد" : "عرض سعر مشتريات جديد")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Prepare a quote for a party before converting it into an invoice.",
              "جهّز عرض سعر لطرف قبل تحويله إلى فاتورة.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="partyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(kind === "sale" ? "Customer" : "Supplier", kind === "sale" ? "العميل" : "المورد")} *</FormLabel>
                    <FormControl>
                      <Combobox options={partyOptions} value={field.value} onValueChange={field.onChange} placeholder={t(kind === "sale" ? "Select a customer…" : "Select a supplier…", kind === "sale" ? "اختر عميلاً…" : "اختر مورّداً…")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Warehouse", "المستودع")}</FormLabel>
                    <FormControl>
                      <Combobox options={warehouseOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder={t("Select a warehouse…", "اختر مستودعاً…")} clearable />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead>{t("Item", "الصنف")}</TableHead>
                    <TableHead className="w-20">{t("Qty", "الكمية")}</TableHead>
                    <TableHead className="w-28">{t("Price", "السعر")}</TableHead>
                    <TableHead className="w-24 text-end">{t("Total", "الإجمالي")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell />
                      <TableCell>
                        <Combobox
                          options={productOptions}
                          value={line.productId || ""}
                          onValueChange={(v) => applyProduct(line.id, v)}
                          placeholder={t("Choose an item…", "اختر صنفاً…")}
                          className="max-w-[240px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <CurrencyInput
                          value={line.unitPrice}
                          currency="USD"
                          onNumericChange={(v) => updateLine(line.id, { unitPrice: v })}
                        />
                      </TableCell>
                      <TableCell className="text-end font-medium tabular-nums">
                        {money(line.lineTotal, "USD")}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== line.id)))}
                          disabled={lines.length === 1}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                          aria-label={t("Remove line", "إزالة السطر")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, defaultLine()])}
                >
                  <Plus className="size-4" />
                  {t("Add line", "إضافة سطر")}
                </Button>
              </div>
            </div>

            <div className="ms-auto w-64 space-y-1.5 text-sm">
              <Row label={t("Subtotal", "المجموع الفرعي")} value={money(subtotal, "USD")} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("Discount %", "نسبة الخصم")}</span>
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <Input type="number" min={0} max={100} className="h-8 w-20 text-end" {...field} />
                  )}
                />
              </div>
              <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
                <span>{t("Total", "الإجمالي")}</span>
                <span className="tabular-nums">{money(total, "USD")}</span>
              </div>
            </div>

            <DialogFooter className="justify-between gap-2 sm:justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <FormField
                  control={form.control}
                  name="quoteDate"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Date", "التاريخ")}</span>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </label>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Valid until", "صالح حتى")}</span>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </label>
                  )}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("Cancel", "إلغاء")}
                </Button>
                <Button type="submit" disabled={!canSubmit || saving}>
                  {saving
                    ? t("Saving…", "جارٍ الحفظ…")
                    : isEdit
                      ? t("Save changes", "حفظ التغييرات")
                      : t("Create quote", "إنشاء عرض سعر")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
