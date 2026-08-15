import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus, ScanBarcode } from "lucide-react";
import { uuid } from "@/lib/utils";
import { invoicesApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { Invoice, InvoiceKind, InvoiceLine } from "@/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
  warehouseId: z.string().min(1, "Select a warehouse"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  discount: z.coerce.number().min(0).default(0),
});

const defaultLine = (): InvoiceLine => ({
  id: uuid("ln"),
  productId: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 8.25,
  discount: 0,
  lineTotal: 0,
});

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InvoiceKind;
  invoice?: Invoice | null;
  parties: PartyLike[];
  products: ProductLike[];
  warehouses: WarehouseLike[];
  stock: StockLike[];
  accounts: BankAccountLike[];
  onSave: (invoice: Invoice) => void;
}

interface PartyLike {
  id: string;
  name: string;
  currency: string;
}
interface WarehouseLike {
  id: string;
  name: string;
  code: string;
}
interface StockLike {
  productId: string;
  warehouseId: string;
  quantity: number;
}
interface ProductLike {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  salePrice: number;
  costPrice: number;
  taxRate: number;
}
interface BankAccountLike {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
}

function methodFor(account?: BankAccountLike): string | undefined {
  const type = account?.type;
  if (type === "cash") return "cash";
  if (type === "credit" || type === "credit-card") return "card";
  if (type === "checking" || type === "bank" || type === "savings") return "bankTransfer";
  return undefined;
}

type FormValues = z.infer<typeof formSchema>;

export function InvoiceFormDialog({
  open,
  onOpenChange,
  kind,
  invoice,
  parties,
  products,
  warehouses,
  stock,
  accounts,
  onSave,
}: InvoiceFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(invoice);
  const [lines, setLines] = useState<InvoiceLine[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  // Payment mode: "paid" records the sale/purchase as settled immediately,
  // "credit" keeps it as an outstanding receivable/payable.
  const [paidNow, setPaidNow] = useState(false);
  // Treasury account used to settle a "paid now" transaction.
  const [paymentAccountId, setPaymentAccountId] = useState("");
  // Purchases only: whether the goods have been received into the warehouse.
  const [received, setReceived] = useState(true);
  // Barcode scanner / manual lookup input (scanners act as a fast keyboard).
  const [scanQuery, setScanQuery] = useState("");
  const [scanError, setScanError] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
    },
  });

  // Latest accounts via ref so the open/reset effect can read them without
  // re-running when the parent passes a new array reference.
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (!open) return;
    setScanQuery("");
    setScanError(false);
    if (invoice) {
      setLines(invoice.lines.map((l) => ({ ...l })));
      setPaidNow(false);
      setPaymentAccountId("");
      setReceived(invoice.kind === "purchase" ? invoice.received ?? false : true);
      form.reset({
        partyId: invoice.partyId,
        warehouseId: invoice.warehouseId ?? "",
        issueDate: new Date(invoice.issueDate),
        dueDate: new Date(invoice.dueDate ?? invoice.issueDate),
        discount:
          invoice.subtotal > 0
            ? Math.round((invoice.discount / invoice.subtotal) * 10000) / 100
            : 0,
      });
      return;
    }
    setLines([defaultLine()]);
    const defaultPaidNow = kind === "purchase";
    setPaidNow(defaultPaidNow);
    setPaymentAccountId("");
    // Purchases default to "paid now", so pre-select a sensible treasury
    // account (petty/cash first) instead of forcing a manual pick.
    if (defaultPaidNow) {
      const active = accountsRef.current.filter((a) => a.isActive !== false);
      const petty = active.find(
        (a) => a.name.toLowerCase().includes("petty") || a.name.toLowerCase().includes("cash"),
      );
      setPaymentAccountId(petty?.id ?? active[0]?.id ?? "");
    }
    form.reset({
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
    });
  }, [open, kind, invoice, form]);

  const selectedWarehouseId = form.watch("warehouseId");

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p.id, label: p.name })),
    [parties],
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
    [warehouses],
  );

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive !== false)
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );

  const stockInWh = (productId: string, warehouseId: string) =>
    stock
      .filter((s) => s.productId === productId && s.warehouseId === warehouseId)
      .reduce((sum, s) => sum + s.quantity, 0);

  const currency = useMemo(() => {
    const party = parties.find((p) => p.id === form.watch("partyId"));
    return party?.currency ?? "USD";
  }, [parties, form]);

  // Product choices for each line. Sales show the available quantity in the
  // selected warehouse so the user sells from real stock.
  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.sku})`,
        meta:
          kind === "sale" && selectedWarehouseId
            ? `${t("Available", "متاح")}: ${stockInWh(p.id, selectedWarehouseId)}`
            : undefined,
      })),
    [products, kind, selectedWarehouseId, stock, t],
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
          taxRate: product.taxRate ?? 8.25,
          lineTotal: Math.round(line.quantity * unitPrice * 100) / 100,
        };
      }),
    );
  };

  const applyFreeText = (lineId: string, text: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, productId: "", description: text || "" } : line)),
    );
  };

  const pickItem = (lineId: string, value: string) => {
    if (value.startsWith("__new__:")) {
      applyFreeText(lineId, value.slice("__new__:".length));
    } else if (value) {
      applyProduct(lineId, value);
    }
  };

  const scanBarcode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const product = products.find((p) => p.barcode && p.barcode.trim() === code);
    if (!product) {
      setScanError(true);
      setScanQuery("");
      return;
    }
    setScanError(false);
    setScanQuery("");
    setLines((prev) => {
      const existing = prev.find(
        (l) => !lineIsFilled(l) || l.productId === product.id,
      );
      if (existing) {
        return prev.map((l) => {
          if (l.id !== existing.id) return l;
          const unitPrice = kind === "sale" ? product.salePrice : product.costPrice;
          return {
            ...l,
            productId: product.id,
            description: product.name,
            quantity: (l.productId === product.id ? l.quantity : 0) + 1,
            unitPrice,
            taxRate: product.taxRate ?? 8.25,
            lineTotal: Math.round(((l.productId === product.id ? l.quantity : 0) + 1) * unitPrice * 100) / 100,
          };
        });
      }
      const line = defaultLine();
      const unitPrice = kind === "sale" ? product.salePrice : product.costPrice;
      return [
        ...prev,
        {
          ...line,
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice,
          taxRate: product.taxRate ?? 8.25,
          lineTotal: unitPrice,
        },
      ];
    });
  };

  const updateLine = (lineId: string, patch: Partial<InvoiceLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        const raw = next.quantity * next.unitPrice;
        next.lineTotal = Math.round(raw * 100) / 100;
        return next;
      }),
    );
  };

  const lineIsFilled = (l: InvoiceLine) => Boolean(l.productId?.trim() || l.description.trim());
  const canSubmit =
    lines.some(lineIsFilled) &&
    !lines.some((l) => !lineIsFilled(l)) &&
    Boolean(selectedWarehouseId) &&
    (!paidNow || Boolean(paymentAccountId));

  const { subtotal, discountAmount, tax, total } = useMemo(() => {
    const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
    const discountPct = Number(form.watch("discount")) || 0;
    const discountAmount = round((subtotal * discountPct) / 100);
    const taxable = subtotal - discountAmount;
    const tax = round(lines.reduce((s, l) => s + l.lineTotal * (l.taxRate / 100), 0));
    return { subtotal, discountAmount, tax, total: round(taxable + tax) };
  }, [lines, form]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const account = accounts.find((a) => a.id === paymentAccountId);
      const payload = {
        customerId: kind === "sale" ? values.partyId : undefined,
        supplierId: kind === "purchase" ? values.partyId : undefined,
        invoiceDate: values.issueDate.toISOString(),
        dueDate: values.dueDate.toISOString(),
        warehouseId: values.warehouseId,
        received: kind === "purchase" ? received : true,
        discount: round(discountAmount),
        paymentMethod: paidNow ? methodFor(account) : undefined,
        paidNow,
        paymentAccountId: paidNow ? account?.id : undefined,
        lines: lines.map((l) => {
          const product = l.productId ? products.find((p) => p.id === l.productId) : undefined;
          return {
            productId: product?.id,
            productName: product?.name ?? l.description,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            discount: l.discount,
          };
        }),
      };
      const record =
        isEdit && invoice
          ? await invoicesApi().update(kind, invoice.id, payload)
          : await invoicesApi().create(kind, {
              type: kind === "sale" ? "sales" : "purchase",
              ...payload,
            });

      onSave(record);
      onOpenChange(false);
      toast.success(
        t("${number} updated", "تم تحديث ${number}").replace(
          "${number}",
          `${t(kind === "sale" ? "Invoice" : "Purchase order", kind === "sale" ? "الفاتورة" : "أمر الشراء")} ${record.number}`,
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
              ? t(kind === "sale" ? "Edit sales invoice" : "Edit purchase order", kind === "sale" ? "تعديل فاتورة مبيعات" : "تعديل أمر شراء")
              : t(kind === "sale" ? "New sales invoice" : "New purchase order", kind === "sale" ? "فاتورة مبيعات جديدة" : "أمر شراء جديد")}
          </DialogTitle>
          <DialogDescription>
            {t(
              kind === "sale"
                ? "References a customer and creates a sale from stock."
                : "References a supplier and delivers goods into a warehouse.",
              kind === "sale"
                ? "يرتبط بالعميل وينشئ بيعاً من المخزون."
                : "يرتبط بالمورد ويسلّم البضاعة إلى مستودع.",
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
                    <FormLabel>{t("Warehouse", "المستودع / المخزون")} *</FormLabel>
                    <FormControl>
                      <Combobox options={warehouseOptions} value={field.value} onValueChange={field.onChange} placeholder={t("Select a warehouse…", "اختر مستودعاً…")} emptyText={t("No warehouses yet — create one in Inventory.", "لا توجد مستودعات بعد — أنشئ واحداً من صفحة المخزون.")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-xl border">
              <div className="flex items-center gap-2 border-b p-2">
                <ScanBarcode className="size-4 text-muted-foreground" />
                <Input
                  value={scanQuery}
                  onChange={(e) => {
                    setScanQuery(e.target.value);
                    if (scanError) setScanError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      scanBarcode(scanQuery);
                    }
                  }}
                  placeholder={t(
                    "Scan or type a barcode, then Enter…",
                    "امسح الباركود أو اكتبه ثم اضغط Enter…",
                  )}
                  className="h-8 flex-1 font-mono"
                  aria-label={t("Barcode", "الباركود")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => scanBarcode(scanQuery)}
                >
                  <ScanBarcode className="size-3.5" />
                  {t("Add", "إضافة")}
                </Button>
                {scanError ? (
                  <span className="text-xs text-destructive">
                    {t("No product with this barcode", "لا يوجد منتج بهذا الباركود")}
                  </span>
                ) : null}
              </div>
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
                          creatable={kind === "purchase"}
                          options={productOptions}
                          value={line.productId || (line.description ? `__new__:${line.description}` : "")}
                          onValueChange={(v) => pickItem(line.id, v)}
                          placeholder={t(
                            kind === "sale" ? "Choose an item from stock…" : "Choose an item…",
                            kind === "sale" ? "اختر صنفاً من المخزون…" : "اختر صنفاً…",
                          )}
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
                          currency={currency}
                          onNumericChange={(v) => updateLine(line.id, { unitPrice: v })}
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
              <Row label={t("Tax (est.)", "الضريبة (تقديرية)")} value={money(tax, currency)} />
              <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
                <span>{t("Total", "الإجمالي")}</span>
                <span className="tabular-nums">{money(total, currency)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    checked={paidNow}
                    onCheckedChange={(c) => {
                      const on = Boolean(c);
                      setPaidNow(on);
                      if (on && !paymentAccountId) {
                        const active = accounts.filter((a) => a.isActive !== false);
                        const petty = active.find(
                          (a) => a.name.toLowerCase().includes("petty") || a.name.toLowerCase().includes("cash"),
                        );
                        setPaymentAccountId(petty?.id ?? active[0]?.id ?? "");
                      }
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">
                      {kind === "sale"
                        ? t("Paid now", "مدفوع الآن")
                        : t("Paid to supplier now", "مدفوع للمورّد الآن")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {kind === "sale"
                        ? t("Settles immediately; no receivable remains.", "يسوّى فوراً ولا يتبقى أي مستحق.")
                        : t("Settles immediately; no payable remains.", "يسوّى فوراً ولا يتبقى أي مطلوب.")}
                    </span>
                  </span>
                </label>
                {paidNow ? (
                  <div className="mt-3 border-t pt-3">
                    <FormLabel>{t("Payment account", "حساب الدفع")}</FormLabel>
                    <Combobox
                      options={accountOptions}
                      value={paymentAccountId}
                      onValueChange={setPaymentAccountId}
                      placeholder={t("Select account…", "اختر الحساب…")}
                      className="mt-1.5"
                      emptyText={t("No treasury accounts yet — create one in Treasury.", "لا توجد حسابات خزينة بعد — أنشئ واحداً من صفحة الخزينة.")}
                    />
                  </div>
                ) : null}
              </div>

              {kind === "purchase" ? (
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm">
                  <Checkbox
                    checked={received}
                    onCheckedChange={(c) => setReceived(Boolean(c))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">{t("Goods received", "تم استلام البضاعة")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("When checked, the items appear in the selected warehouse inventory immediately.", "عند التحقق، تظهر الأصناف في مخزون المستودع المحدد فوراً.")}
                    </span>
                  </span>
                </label>
              ) : null}
            </div>

            <DialogFooter className="justify-between gap-2 sm:justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Date", "التاريخ")}</span>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </label>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <label className="flex items-center gap-2">
                      <span>{t("Due", "الاستحقاق")}</span>
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
                      : t(kind === "sale" ? "Create invoice" : "Create order", kind === "sale" ? "إنشاء فاتورة" : "إنشاء أمر شراء")}
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