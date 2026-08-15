import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";
import { uuid } from "@/lib/utils";
import { notesApi } from "@/lib/api";
import { useCustomersStore, useSuppliersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useWarehousesStore } from "@/stores/inventory-store";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { TradeNote, TradeNoteLine } from "@/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
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
  type: z.enum(["sales", "purchase"]),
  noteType: z.enum(["credit", "debit"]),
  invoiceId: z.string().optional(),
  partyId: z.string().min(1, "Select a party"),
  warehouseId: z.string().optional(),
  noteDate: z.coerce.date(),
  discount: z.coerce.number().min(0).default(0),
});

const defaultLine = (): TradeNoteLine => ({
  id: uuid("nl"),
  productId: "",
  productName: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 8.25,
  lineTotal: 0,
});

interface NoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (note: TradeNote) => void;
}

type FormValues = z.infer<typeof formSchema>;

export function NoteFormDialog({ open, onOpenChange, onSave }: NoteFormDialogProps) {
  const { t } = useT();
  const customers = useCustomersStore((s) => s.items);
  const suppliers = useSuppliersStore((s) => s.items);
  const products = useProductsStore((s) => s.items);
  const invoices = useInvoicesStore((s) => s.items);
  const warehouses = useWarehousesStore((s) => s.items);

  const [lines, setLines] = useState<TradeNoteLine[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "sales", noteType: "credit", noteDate: new Date(), discount: 0 },
  });

  const selectedType = form.watch("type");
  const selectedInvoiceId = form.watch("invoiceId");

  useEffect(() => {
    if (!open) return;
    setLines([defaultLine()]);
    form.reset({ type: "sales", noteType: "credit", noteDate: new Date(), discount: 0 });
  }, [open, form]);

  // Keep the party in sync with the selected invoice.
  useEffect(() => {
    if (!selectedInvoiceId) return;
    const inv = invoices.find((i) => i.id === selectedInvoiceId);
    if (inv?.partyId) {
      form.setValue("partyId", inv.partyId);
    }
  }, [selectedInvoiceId, invoices, form]);

  const parties = selectedType === "sales" ? customers : suppliers;

  const allParties = useMemo(
    () => [...customers, ...suppliers].reduce<Record<string, string>>((map, p) => {
      map[p.id] = p.name;
      return map;
    }, {}),
    [customers, suppliers],
  );

  const invoiceOptions = useMemo(
    () =>
      invoices
        .filter((i) => i.kind === (selectedType === "sales" ? "sale" : "purchase") && i.status !== "cancelled")
        .map((i) => ({
          value: i.id,
          label: `${i.number} — ${allParties[i.partyId] ?? ""}`.trim(),
        })),
    [invoices, selectedType, allParties],
  );

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p.id, label: p.name })),
    [parties],
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
    [warehouses],
  );

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
    [products],
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
          unitPrice: product.salePrice,
          taxRate: product.taxRate ?? 8.25,
          lineTotal: Math.round(line.quantity * product.salePrice * 100) / 100,
        };
      }),
    );
  };

  const applyFreeText = (lineId: string, text: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, productId: "", productName: text || "" } : line)),
    );
  };

  const pickItem = (lineId: string, value: string) => {
    if (value.startsWith("__new__:")) {
      applyFreeText(lineId, value.slice("__new__:".length));
    } else if (value) {
      applyProduct(lineId, value);
    }
  };

  const updateLine = (lineId: string, patch: Partial<TradeNoteLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        const gross = Math.max(0, next.quantity * next.unitPrice - next.discount);
        next.lineTotal = Math.round(gross * (1 + next.taxRate / 100) * 100) / 100;
        return next;
      }),
    );
  };

  const lineIsFilled = (l: TradeNoteLine) => Boolean(l.productName?.trim());
  const canSubmit = lines.some(lineIsFilled) && !lines.some((l) => !lineIsFilled(l));

  const { subtotal, tax, total } = useMemo(() => {
    const subtotal = round(lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0));
    const lineTotals = lines.reduce((s, l) => s + l.lineTotal, 0);
    const tax = round(Math.max(0, lineTotals - subtotal));
    const discount = Number(form.watch("discount")) || 0;
    return { subtotal, tax, total: round(Math.max(0, subtotal + tax - discount)) };
  }, [lines, form]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const record = await notesApi().create({
        type: values.type,
        noteType: values.noteType,
        invoiceId: values.invoiceId || undefined,
        partyId: values.partyId,
        warehouseId: values.warehouseId || undefined,
        noteDate: values.noteDate.toISOString(),
        discount: round(values.discount),
        reason: (document.getElementById("note-reason") as HTMLInputElement | null)?.value || undefined,
        lines: lines.map((l) => ({
          productId: l.productId || undefined,
          productName: l.productName,
          description: l.description || l.productName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
        })),
      });
      onSave(record);
      onOpenChange(false);
      toast.success(
        t("${number} created", "تم إنشاء ${number}").replace("${number}", record.number),
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
          <DialogTitle>{t("New credit/debit note", "إشعار دائن/مدين جديد")}</DialogTitle>
          <DialogDescription>
            {t("Adjust an invoice total and stock with a credit or debit note.", "اضبط إجمالي الفاتورة والمخزون من خلال إشعار دائن أو مدين.")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Module", "الوحدة")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: "sales", label: t("Sales", "المبيعات") },
                          { value: "purchase", label: t("Purchases", "المشتريات") },
                        ]}
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("invoiceId", "");
                          form.setValue("partyId", "");
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="noteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Note type", "نوع الإشعار")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: "credit", label: t("Credit note", "إشعار دائن") },
                          { value: "debit", label: t("Debit note", "إشعار مدين") },
                        ]}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="invoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Linked invoice", "الفاتورة المرتبطة")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={invoiceOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder={t("Optional — pick an invoice…", "اختياري — اختر فاتورة…")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(selectedType === "sales" ? "Customer" : "Supplier", selectedType === "sales" ? "العميل" : "المورد")} *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={partyOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder={t("Select a party…", "اختر طرفاً…")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Warehouse", "المستودع")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={warehouseOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder={t("Optional — affects stock", "اختياري — يؤثر على المخزون")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="noteDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Date", "التاريخ")}</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
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
                          creatable
                          options={productOptions}
                          value={line.productId || (line.productName ? `__new__:${line.productName}` : "")}
                          onValueChange={(v) => pickItem(line.id, v)}
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
                        {formatMoney(line.lineTotal)}
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
              <Row label={t("Subtotal", "المجموع الفرعي")} value={formatMoney(subtotal)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("Discount", "الخصم")}</span>
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <Input type="number" min={0} className="h-8 w-24 text-end" {...field} />
                  )}
                />
              </div>
              <Row label={t("Tax", "الضريبة")} value={formatMoney(tax)} />
              <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
                <span>{t("Total", "الإجمالي")}</span>
                <span className="tabular-nums">{formatMoney(total)}</span>
              </div>
            </div>

            <Textarea
              id="note-reason"
              placeholder={t("Reason (e.g. returned goods, price adjustment)…", "السبب (مثل: بضاعة مرتجعة، تعديل سعر)…")}
              rows={2}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving ? t("Saving…", "جارٍ الحفظ…") : t("Create note", "إنشاء الإشعار")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
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
