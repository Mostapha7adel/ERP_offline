import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, type TransactionFormValues } from "@/lib/schemas";
import type { MoneyTransaction } from "@/types/domain";
import { treasuryApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";
import { Combobox } from "@/shared/components/forms/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { DatePicker } from "@/shared/components/forms/date-picker";
import { CurrencyInput } from "@/shared/components/forms/currency-input";

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccounts: Array<{ id: string; name: string }>;
  onSave: (txn: MoneyTransaction) => void;
}

const CATEGORIES = [
  "Accounts Receivable", "Accounts Payable", "Payroll", "Utilities", "Marketing",
  "Vendor Payments", "Transfers", "Cash Sales", "Rent", "Shipping",
];

const CATEGORY_LABELS: Record<string, string> = {
  "Accounts Receivable": "حسابات القبض",
  "Accounts Payable": "حسابات الدفع",
  Payroll: "الرواتب والأجور",
  Utilities: "المرافق",
  Marketing: "التسويق",
  "Vendor Payments": "مدفوعات الموردين",
  Transfers: "تحويلات",
  "Cash Sales": "مبيعات نقدية",
  Rent: "الإيجار",
  Shipping: "الشحن",
};

export function TransactionFormDialog({ open, onOpenChange, bankAccounts, onSave }: TransactionFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const { t } = useT();
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      reference: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date(),
      type: "inflow",
      category: "Accounts Receivable",
      amount: 0,
      bankAccountId: bankAccounts[0]?.id ?? "",
    },
  });

  const onSubmit = async (values: TransactionFormValues) => {
    setSaving(true);
    try {
      const record = await treasuryApi().createTransaction({
        accountId: values.bankAccountId,
        type: values.type === "inflow" ? "income" : values.type === "outflow" ? "expense" : "transfer",
        amount: Number(values.amount),
        category: values.category,
        reference: values.reference?.trim(),
        description: values.description,
        date: values.date.toISOString(),
      });
      onSave(record);
      onOpenChange(false);
      form.reset();
      toast.success(t("Transaction recorded", "تم تسجيل المعاملة"));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const accounts = bankAccounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Record transaction", "تسجيل معاملة")}</DialogTitle>
          <DialogDescription>{t("Log a cash inflow, outflow or transfer.", "سجّل تدفقاً نقدياً وارداً أو صادراً أو تحويلاً.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="bankAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Account *", "الحساب *")}</FormLabel>
                  <FormControl>
                    <Combobox options={accounts} value={field.value} onValueChange={field.onChange} placeholder={t("Select account…", "اختر الحساب…")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Type *", "النوع *")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("Select type", "اختر النوع")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="inflow">{t("Inflow", "وارد")}</SelectItem>
                      <SelectItem value="outflow">{t("Outflow", "صادر")}</SelectItem>
                      <SelectItem value="transfer">{t("Transfer", "تحويل")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Amount *", "المبلغ *")}</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onNumericChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Date", "التاريخ")}</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onValueChange={field.onChange} toDate={new Date()} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Category", "الفئة")}</FormLabel>
                <FormControl>
                  <Combobox
                    options={CATEGORIES.map((c) => ({ value: c, label: t(c, CATEGORY_LABELS[c] ?? c) }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("Select category…", "اختر الفئة…")}
                  />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Description *", "الوصف *")}</FormLabel>
                <FormControl><Input placeholder={t("What is this for?", "ما الغرض من هذه الحركة؟")} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="reference" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Reference", "المرجع")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
              <Button type="submit" disabled={saving}>{saving ? t("Saving…", "جارٍ الحفظ…") : t("Record transaction", "تسجيل معاملة")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}