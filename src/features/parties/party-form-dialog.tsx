import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { partySchema, type PartyFormValues } from "@/lib/schemas";
import type { Party, PartyType } from "@/types/domain";
import { partiesApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { useT } from "@/shared/lib/i18n";
import { translateApiError } from "@/shared/lib/translate-api-error";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/forms/form";

const PAYMENT_TERMS = [
  { value: "Due on receipt", label: "Due on receipt", labelAr: "عند الاستلام" },
  { value: "Net 15", label: "Net 15" },
  { value: "Net 30", label: "Net 30" },
  { value: "Net 45", label: "Net 45" },
  { value: "Net 60", label: "Net 60" },
];

interface PartyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PartyType;
  party?: Party | null;
  onSave: (party: Party) => void;
  nextCode: string;
}

export function PartyFormDialog({
  open,
  onOpenChange,
  type,
  party,
  onSave,
  nextCode,
}: PartyFormDialogProps) {
  const isEdit = Boolean(party);
  const [saving, setSaving] = useState(false);
  const { t } = useT();
  const form = useForm<PartyFormValues>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: party?.name ?? "",
      code: party?.code ?? nextCode,
      email: party?.email ?? "",
      phone: party?.phone ?? "",
      taxId: party?.taxId ?? "",
      paymentTerms: party?.paymentTerms ?? "Net 30",
      currency: party?.currency ?? "USD",
      status: party?.status ?? "active",
      street: party?.address.street ?? "",
      city: party?.address.city ?? "",
      state: party?.address.state ?? "",
      country: party?.address.country ?? "",
      postalCode: party?.address.postalCode ?? "",
      note: party?.note ?? "",
    },
  });

  // The dialog stays mounted between opens, so React Hook Form's defaultValues
  // are only captured once at mount. Reset with the current record each time
  // the dialog opens, otherwise edit forms would show empty fields.
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: party?.name ?? "",
      code: party?.code ?? nextCode,
      email: party?.email ?? "",
      phone: party?.phone ?? "",
      taxId: party?.taxId ?? "",
      paymentTerms: party?.paymentTerms ?? "Net 30",
      currency: party?.currency ?? "USD",
      status: party?.status ?? "active",
      street: party?.address.street ?? "",
      city: party?.address.city ?? "",
      state: party?.address.state ?? "",
      country: party?.address.country ?? "",
      postalCode: party?.address.postalCode ?? "",
      note: party?.note ?? "",
    });
  }, [open, party, nextCode, form]);

  const onSubmit = async (values: PartyFormValues) => {
    setSaving(true);
    try {
      const input = {
        name: values.name.trim(),
        code: values.code?.trim() || nextCode,
        email: values.email.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        address: [values.street, values.city, values.state].filter(Boolean).join(", ") || undefined,
        city: values.city || undefined,
        taxNumber: values.taxId?.trim() || undefined,
        currency: values.currency,
        notes: values.note || undefined,
        status: values.status === "inactive" ? ("inactive" as const) : ("active" as const),
      };
      const record = isEdit && party
        ? await partiesApi().update(party.id, input)
        : await partiesApi().create(type, input);
      onSave(record);
      onOpenChange(false);
      form.reset();
      toast.success(
        `${type === "customer" ? t("Customer", "العميل") : t("Supplier", "المورد")} ${
          isEdit ? t("updated", "تم تحديثه") : t("created", "تم إنشاؤه")
        }`,
      );
    } catch (error) {
      toast.error(translateApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("Edit", "تعديل") : t("Add", "إضافة")}{" "}
            {type === "customer" ? t("customer", "عميل") : t("supplier", "مورد")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Organization details are shared across invoices and reports.",
              "بيانات المنظمة مشتركة عبر الفواتير والتقارير.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Name *", "الاسم *")}</FormLabel>
                    <FormControl>
                      <Input placeholder={type === "customer" ? t("Company or client", "شركة أو عميل") : t("Vendor name", "اسم المورد")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Code", "الكود")}</FormLabel>
                    <FormControl>
                      <Input placeholder={nextCode} disabled={isEdit} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Email", "البريد الإلكتروني")}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="billing@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Phone", "الهاتف")}</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Tax ID", "الرقم الضريبي")}</FormLabel>
                    <FormControl>
                      <Input placeholder="TAX-0000-0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Payment terms", "شروط الدفع")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TERMS.map((term) => (
                          <SelectItem key={term.value} value={term.value}>{t(term.label, term.labelAr ?? term.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["USD", "EUR", "GBP", "AED", "SAR", "EGP"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Address", "العنوان")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Street", "الشارع")}</FormLabel>
                      <FormControl>
                        <Input placeholder="100 Market Street" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("City", "المدينة")}</FormLabel>
                      <FormControl>
                        <Input placeholder="San Francisco" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("State / Region", "الولاية / المنطقة")}</FormLabel>
                      <FormControl>
                        <Input placeholder="CA" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Country", "الدولة")}</FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Postal code", "الرمز البريدي")}</FormLabel>
                        <FormControl>
                          <Input placeholder="94105" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Note", "ملاحظة")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("Optional internal note…", "ملاحظة داخلية اختيارية…")} className="resize-none" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? t("Saving…", "جارٍ الحفظ…")
                  : isEdit
                    ? t("Save changes", "حفظ التغييرات")
                    : type === "customer"
                      ? t("Create customer", "إنشاء عميل")
                      : t("Create supplier", "إنشاء مورد")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}