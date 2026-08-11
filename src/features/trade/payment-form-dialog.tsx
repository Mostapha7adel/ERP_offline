import { useEffect, useMemo, useState } from "react";
import { Banknote } from "lucide-react";
import { invoicesApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { formatCurrency } from "@/lib/format";
import type { Invoice, InvoiceKind } from "@/types/domain";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/shared/components/forms/form";
import { Combobox } from "@/shared/components/forms/combobox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
});

type FormValues = z.infer<typeof formSchema>;

interface BankAccountLike {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
}

interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InvoiceKind;
  invoice: Invoice | null;
  accounts: BankAccountLike[];
  onSaved: (invoice: Invoice) => void;
  onClosed: () => void;
}

function methodFor(account?: BankAccountLike): string | undefined {
  const type = account?.type;
  if (type === "cash") return "cash";
  if (type === "credit" || type === "credit-card") return "card";
  if (type === "checking" || type === "bank" || type === "savings") return "bankTransfer";
  return undefined;
}

export function PaymentFormDialog({ open, onOpenChange, kind, invoice, accounts, onSaved, onClosed }: PaymentFormDialogProps) {
  const { t } = useT();
  const [saving, setSaving] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive !== false), [accounts]);
  const amount = invoice ? Math.round(Math.max(0, invoice.total - invoice.paid) * 100) / 100 : 0;

  const preferred = useMemo(() => {
    const petty = activeAccounts.find((a) => a.name.toLowerCase().includes("petty") || a.name.toLowerCase().includes("cash"));
    return petty?.id ?? activeAccounts[0]?.id ?? "";
  }, [activeAccounts]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { accountId: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ accountId: preferred });
    }
  }, [open, preferred, form]);

  if (!invoice) return null;

  const accountOptions = activeAccounts.map((a) => ({
    value: a.id,
    label: a.name,
    meta: formatCurrency(0),
  }));

  const onSubmit = async (values: FormValues) => {
    if (!invoice) return;
    setSaving(true);
    try {
      const account = activeAccounts.find((a) => a.id === values.accountId);
      const updated = await invoicesApi().registerPayment(kind, invoice.id, {
        amount,
        method: methodFor(account),
        accountId: values.accountId,
      });
      onSaved(updated);
      onOpenChange(false);
      onClosed();
      toast.success(t("Payment recorded", "تم تسجيل الدفعة"));
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5" />
            {t("Record payment", "تسجيل دفعة")}
          </DialogTitle>
          <DialogDescription>
            {invoice.number} · {formatCurrency(amount)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("Amount to receive", "المبلغ المراد استلامه")}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>
              </div>
            </div>
            <FormField control={form.control} name="accountId" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("Treasury account *", "حساب الخزينة *")}</FormLabel>
                <FormControl>
                  <Combobox
                    options={accountOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("Select account…", "اختر الحساب…")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { onOpenChange(false); onClosed(); }}>
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("Recording…", "جارٍ التسجيل…") : t("Confirm payment", "تأكيد الدفعة")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
