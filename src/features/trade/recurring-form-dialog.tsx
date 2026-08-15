import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";
import { uuid } from "@/lib/utils";
import { recurringApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { RecurringInvoice, InvoiceKind, RecurringFrequency, QuoteLine } from "@/types/domain";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";

const formSchema = z.object({
  partyId: z.string().min(1, "Select a party"),
  warehouseId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  nextRunDate: z.coerce.date(),
  discount: z.coerce.number().min(0).default(0),
});

const defaultLine = (): QuoteLine => ({
  id: uuid("ln"),
  productId: undefined,
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
  lineTotal: 0,
});

interface RecurringFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InvoiceKind;
  recurring?: RecurringInvoice | null;
  parties: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; salePrice: number; costPrice: number }[];
  warehouses: { id: string; name: string; code: string }[];
  onSave: (recurring: RecurringInvoice) => void;
}

type FormValues = z.infer<typeof formSchema>;

const frequencyLabels: Record<RecurringFrequency, { en: string; ar: string }> = {
  daily: { en: "Daily", ar: "يومي" },
  weekly: { en: "Weekly", ar: "أسبوعي" },
  monthly: { en: "Monthly", ar: "شهري" },
  quarterly: { en: "Quarterly", ar: "ربع سنوي" },
  yearly: { en: "Yearly", ar: "سنوي" },
};

export function RecurringFormDialog({
  open,
  onOpenChange,
  kind,
  recurring,
  parties,
  products,
  warehouses,
  onSave,
}: RecurringFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(recurring);
  const [lines, setLines] = useState<QuoteLine[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { frequency: "monthly", interval: 1, nextRunDate: new Date(), discount: 0 },
  });

  useEffect(() => {
    if (!open) return;
    if (recurring) {
      setLines(recurring.lines.map((l) => ({ ...l })));
      form.reset({
        partyId: recurring.partyId,
        warehouseId: recurring.warehouseId ?? "",
        frequency: recurring.frequency,
        interval: recurring.interval,
        nextRunDate: new Date(recurring.nextRunDate),
        discount:
          recurring.subtotal > 0
            ? Math.round((recurring.discount / recurring.subtotal) * 10000) / 100
            : 0,
      });
      return;
    }
    setLines([defaultLine()]);
    form.reset({
      partyId: "",
      warehouseId: "",
      frequency: "monthly",
      interval: 1,
      nextRunDate: new Date(),
      discount: 0,
    });
  }, [open, kind, recurring, form]);

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
        warehouseId: values.warehouseId || undefined,
        frequency: values.frequency,
        interval: values.interval,
        nextRunDate: values.nextRunDate.toISOString(),
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
        isEdit && recurring
          ? await recurringApi().update(kind, recurring.id, payload)
          : await recurringApi().create(kind, {
              type: kind === "sale" ? "sales" : "purchase",
              ...payload,
            });
      onSave(record);
      onOpenChange(false);
      toast.success(
        t("${number} saved", "تم حفظ ${number}").replace(
          "${number}",
          `${t("Recurring invoice", "الفاتورة الدورية")} ${record.number}`,
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
              ? t("Edit recurring invoice", "تعديل الفاتورة الدورية")
              : t("New recurring invoice", "فاتورة دورية جديدة")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Automatically generates invoices on a schedule.",
              "تُنشئ فواتير تلقائياً وفقاً لجدول زمني.",
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
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Frequency", "التكرار")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(frequencyLabels) as RecurringFrequency[]).map((f) => (
                            <SelectItem key={f} value={f}>
                              {t(frequencyLabels[f].en, frequencyLabels[f].ar)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Every (interval)", "كل (الفاصل)")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={365} {...field} />
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
                  name="nextRunDate"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Next run", "التشغيل القادم")}</span>
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
                      : t("Create recurring", "إنشاء فاتورة دورية")}
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
