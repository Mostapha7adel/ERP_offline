import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";
import { uuid } from "@/lib/utils";
import { purchaseOrdersApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { PurchaseOrder, PurchaseOrderLine } from "@/types/domain";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";

const formSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  warehouseId: z.string().optional(),
  orderDate: z.coerce.date(),
  expectedDate: z.coerce.date().optional(),
  discount: z.coerce.number().min(0).default(0),
  currency: z.string().default("EGP"),
  notes: z.string().optional(),
});

const defaultLine = (): PurchaseOrderLine => ({
  id: uuid("ln"),
  purchaseOrderId: "",
  productId: "",
  productName: "",
  description: "",
  quantity: 1,
  receivedQty: 0,
  unitPrice: 0,
  discount: 0,
  taxRate: 0,
  lineTotal: 0,
});

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: PurchaseOrder | null;
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; costPrice: number }[];
  warehouses: { id: string; name: string; code: string }[];
  currencies: { code: string; name: string }[];
  onSave: (order: PurchaseOrder) => void;
}

type FormValues = z.infer<typeof formSchema>;

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  order,
  suppliers,
  products,
  warehouses,
  currencies,
  onSave,
}: PurchaseOrderFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(order);
  const [lines, setLines] = useState<PurchaseOrderLine[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { orderDate: new Date(), discount: 0, currency: "EGP" },
  });

  useEffect(() => {
    if (!open) return;
    if (order) {
      setLines(order.lines.map((l) => ({ ...l })));
      form.reset({
        supplierId: order.supplierId,
        warehouseId: order.warehouseId ?? "",
        orderDate: new Date(order.orderDate),
        expectedDate: order.expectedDate ? new Date(order.expectedDate) : undefined,
        discount: order.discount,
        currency: order.currency || "EGP",
        notes: order.notes ?? "",
      });
      return;
    }
    setLines([defaultLine()]);
    form.reset({
      supplierId: "",
      warehouseId: "",
      orderDate: new Date(),
      expectedDate: new Date(Date.now() + 14 * 86400000),
      discount: 0,
      currency: "EGP",
      notes: "",
    });
  }, [open, order, form]);

  const supplierOptions = useMemo(
    () => suppliers.map((p) => ({ value: p.id, label: p.name })),
    [suppliers],
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

  const currencyOptions = useMemo(
    () =>
      currencies.map((c) => ({
        value: c.code,
        label: `${c.code}${c.name ? ` — ${c.name}` : ""}`,
      })),
    [currencies],
  );

  const applyProduct = (lineId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          productId: product.id,
          productName: product.name,
          description: product.name,
          unitPrice: product.costPrice,
          lineTotal: Math.round(line.quantity * product.costPrice * 100) / 100,
        };
      }),
    );
  };

  const updateLine = (lineId: string, patch: Partial<PurchaseOrderLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        next.lineTotal = Math.round(next.quantity * next.unitPrice * 100) / 100;
        return next;
      }),
    );
  };

  const lineIsFilled = (l: PurchaseOrderLine) =>
    Boolean(l.productName?.trim() || l.productId);
  const canSubmit = lines.length > 0 && lines.every(lineIsFilled);

  const { subtotal, total } = useMemo(() => {
    const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
    const discountPct = Number(form.watch("discount")) || 0;
    const discountAmount = round((subtotal * discountPct) / 100);
    return { subtotal, total: round(subtotal - discountAmount) };
  }, [lines, form]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        supplierId: values.supplierId,
        orderDate: values.orderDate.toISOString(),
        expectedDate: values.expectedDate?.toISOString(),
        warehouseId: values.warehouseId || undefined,
        discount: round((subtotal * (Number(values.discount) || 0)) / 100),
        currency: values.currency,
        notes: values.notes || undefined,
        lines: lines.map((l) => ({
          productId: l.productId || undefined,
          productName: l.productName || l.description || "",
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
        })),
      };
      const record =
        isEdit && order
          ? await purchaseOrdersApi().update(order.id, payload)
          : await purchaseOrdersApi().create(payload);
      onSave(record);
      onOpenChange(false);
      toast.success(
        t("${number} saved", "تم حفظ ${number}").replace(
          "${number}",
          `${t("Purchase order", "أمر شراء")} ${record.number}`,
        ),
      );
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const currency = form.watch("currency") || "EGP";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("Edit purchase order", "تعديل أمر الشراء")
              : t("New purchase order", "أمر شراء جديد")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Create a purchase order to approve and receive supplier goods.",
              "أنشئ أمر شراء لاعتماد واستلام بضائع المورد.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Supplier", "المورد")} *</FormLabel>
                    <FormControl>
                      <Combobox options={supplierOptions} value={field.value} onValueChange={field.onChange} placeholder={t("Select a supplier…", "اختر مورّداً…")} />
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
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Currency", "العملة")}</FormLabel>
                    <FormControl>
                      <Combobox options={currencyOptions} value={field.value} onValueChange={field.onChange} placeholder={t("Select currency…", "اختر العملة…")} />
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
                    <TableHead className="w-28">{t("Unit price", "سعر الوحدة")}</TableHead>
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
                        <Input
                          value={line.productName}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.id === line.id
                                  ? { ...l, productName: e.target.value }
                                  : l,
                              ),
                            )
                          }
                          placeholder={t("Or type a name…", "أو اكتب الاسم…")}
                          className="mt-1 max-w-[240px] text-sm"
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
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-end font-medium tabular-nums">
                        {money(line.lineTotal, currency)}
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
              <Row label={t("Subtotal", "المجموع الفرعي")} value={money(subtotal, currency)} />
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
                <span className="tabular-nums">{money(total, currency)}</span>
              </div>
            </div>

            <DialogFooter className="justify-between gap-2 sm:justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Order date", "تاريخ الأمر")}</span>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </label>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDate"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Expected", "المتوقع")}</span>
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
                      : t("Create order", "إنشاء أمر الشراء")}
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