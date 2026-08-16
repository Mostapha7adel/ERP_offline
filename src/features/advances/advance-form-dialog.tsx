import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { advancesApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { CustomerAdvance } from "@/types/domain";
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
import { Textarea } from "@/shared/components/ui/textarea";

const formSchema = z.object({
  partyId: z.string().min(1, "Select a customer"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  currency: z.string().default("EGP"),
  date: z.coerce.date(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

interface AdvanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advance?: CustomerAdvance | null;
  customers: { id: string; name: string }[];
  currencies: { code: string; name: string }[];
  onSave: (advance: CustomerAdvance) => void;
}

type FormValues = z.infer<typeof formSchema>;

export function AdvanceFormDialog({
  open,
  onOpenChange,
  advance,
  customers,
  currencies,
  onSave,
}: AdvanceFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(advance);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0, currency: "EGP", date: new Date() },
  });

  useEffect(() => {
    if (!open) return;
    if (advance) {
      form.reset({
        partyId: advance.partyId,
        amount: advance.amount,
        currency: advance.currency,
        date: new Date(advance.date),
        method: advance.method ?? "",
        reference: advance.reference ?? "",
        notes: advance.notes ?? "",
      });
      return;
    }
    form.reset({
      partyId: "",
      amount: 0,
      currency: "EGP",
      date: new Date(),
      method: "",
      reference: "",
      notes: "",
    });
  }, [open, advance, form]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.name })),
    [customers],
  );

  const currencyOptions = useMemo(
    () =>
      currencies.map((c) => ({
        value: c.code,
        label: `${c.code}${c.name ? ` — ${c.name}` : ""}`,
      })),
    [currencies],
  );

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        partyId: values.partyId,
        amount: values.amount,
        currency: values.currency,
        date: values.date.toISOString(),
        method: values.method || undefined,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      };
      const record =
        isEdit && advance
          ? await advancesApi().update(advance.id, payload)
          : await advancesApi().create(payload);
      onSave(record);
      onOpenChange(false);
      toast.success(t("Advance saved", "تم حفظ السلفة"));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("Edit advance", "تعديل السلفة")
              : t("Record customer advance", "تسجيل سلفة عميل")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Record an advance payment collected from a customer.",
              "سجّل دفعة مقدمة محصّلة من العميل.",
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
                    <FormLabel>{t("Customer", "العميل")} *</FormLabel>
                    <FormControl>
                      <Combobox options={customerOptions} value={field.value} onValueChange={field.onChange} placeholder={t("Select a customer…", "اختر عميلاً…")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Amount", "المبلغ")} *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
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
              <FormField
                control={form.control}
                name="date"
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
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Method", "طريقة الدفع")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("Cash, bank transfer…", "نقداً، تحويل بنكي…")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Reference", "المرجع")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("Notes", "ملاحظات")}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit" loading={saving}>
                {saving
                  ? t("Saving…", "جارٍ الحفظ…")
                  : isEdit
                    ? t("Save changes", "حفظ التغييرات")
                    : t("Record advance", "تسجيل السلفة")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}