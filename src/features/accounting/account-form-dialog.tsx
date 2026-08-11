import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { accountingApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import type { Account, AccountType } from "@/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { CurrencyInput } from "@/shared/components/forms/currency-input";

const schema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(2, "Account name is required"),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  category: z.string().min(1, "Category is required"),
  openingBalance: z.coerce.number().default(0),
});

type Values = z.infer<typeof schema>;

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (account: Account) => void;
}

export function AccountFormDialog({ open, onOpenChange, onSave }: AccountFormDialogProps) {
  const [opening, setOpening] = useState(0);
  const [saving, setSaving] = useState(false);
  const { t } = useT();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "asset", category: "Current Assets", openingBalance: 0 },
  });

  const watchedType = form.watch("type");
  const categoryOptions = typeCategories(watchedType);

  const onSubmit = async (values: Values) => {
    setSaving(true);
    try {
      const account = await accountingApi().createAccount({
        code: values.code,
        name: values.name,
        type: values.type,
        category: values.category,
        openingBalance: opening,
        isActive: true,
      });
      onSave(account);
      onOpenChange(false);
      form.reset();
      setOpening(0);
      toast.success(t("Account created", "تم إنشاء الحساب"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to create account", "تعذّر إنشاء الحساب"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Add account", "إضافة حساب")}</DialogTitle>
          <DialogDescription>{t("Create a new ledger account in the chart of accounts.", "أنشئ حساباً دفترية جديداً في دليل الحسابات.")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Code *", "الرمز *")}</FormLabel>
                  <FormControl><Input placeholder="7000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Name *", "الاسم *")}</FormLabel>
                  <FormControl><Input placeholder={t("e.g. Office Supplies", "مثال: اللوازم المكتبية")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                      {TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{t(option.label, option.labelAr)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Category *", "الفئة *")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("Select category", "اختر الفئة")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>{t(c, CATEGORY_LABELS[c] ?? c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div>
              <FormLabel>{t("Opening balance", "الرصيد الافتتاحي")}</FormLabel>
              <CurrencyInput value={opening} onNumericChange={setOpening} className="mt-1.5" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel", "إلغاء")}</Button>
              <Button type="submit" disabled={saving}>{saving ? t("Creating…", "جارٍ الإنشاء…") : t("Create account", "إنشاء الحساب")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const TYPES: Array<{ value: AccountType; label: string; labelAr: string }> = [
  { value: "asset", label: "Asset", labelAr: "أصل" },
  { value: "liability", label: "Liability", labelAr: "التزام" },
  { value: "equity", label: "Equity", labelAr: "حقوق ملكية" },
  { value: "revenue", label: "Revenue", labelAr: "إيراد" },
  { value: "expense", label: "Expense", labelAr: "مصروف" },
];

const CATEGORY_LABELS: Record<string, string> = {
  "Current Assets": "الأصول المتداولة",
  "Fixed Assets": "الأصول الثابتة",
  "Current Liabilities": "الالتزامات المتداولة",
  "Long-term Liabilities": "الالتزامات طويلة الأجل",
  Equity: "حقوق الملكية",
  Revenue: "الإيرادات",
  "Cost of Sales": "تكلفة المبيعات",
  "Operating Expenses": "المصاريف التشغيلية",
  "Other Expenses": "مصاريف أخرى",
};

function typeCategories(type?: AccountType): string[] {
  switch (type) {
    case "asset":
      return ["Current Assets", "Fixed Assets"];
    case "liability":
      return ["Current Liabilities", "Long-term Liabilities"];
    case "equity":
      return ["Equity"];
    case "revenue":
      return ["Revenue"];
    default:
      return ["Cost of Sales", "Operating Expenses", "Other Expenses"];
  }
}