import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { assetsApi } from "@/lib/api";
import { useT } from "@/shared/lib/i18n";
import { toast } from "@/shared/lib/toast";
import { translateApiError } from "@/shared/lib/translate-api-error";
import type { Asset } from "@/types/domain";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

const formSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  purchaseDate: z.coerce.date(),
  cost: z.coerce.number().nonnegative().default(0),
  salvageValue: z.coerce.number().nonnegative().default(0),
  usefulLifeMonths: z.coerce.number().int().positive("Useful life must be greater than zero"),
  depreciationMethod: z.enum(["straight-line", "declining"]).default("straight-line"),
  accountId: z.string().optional(),
  notes: z.string().optional(),
});

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
  accounts: { id: string; name: string; code: string }[];
  onSave: (asset: Asset) => void;
}

type FormValues = z.infer<typeof formSchema>;

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  accounts,
  onSave,
}: AssetFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(asset);
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      category: "",
      purchaseDate: new Date(),
      cost: 0,
      salvageValue: 0,
      usefulLifeMonths: 36,
      depreciationMethod: "straight-line",
      accountId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (asset) {
      form.reset({
        code: asset.code,
        name: asset.name,
        category: asset.category ?? "",
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : new Date(),
        cost: asset.cost,
        salvageValue: asset.salvageValue,
        usefulLifeMonths: asset.usefulLifeMonths,
        depreciationMethod: asset.depreciationMethod,
        accountId: asset.accountId ?? "",
        notes: "",
      });
      return;
    }
    form.reset({
      code: "",
      name: "",
      category: "",
      purchaseDate: new Date(),
      cost: 0,
      salvageValue: 0,
      usefulLifeMonths: 36,
      depreciationMethod: "straight-line",
      accountId: "",
      notes: "",
    });
  }, [open, asset, form]);

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [accounts],
  );

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        code: values.code,
        name: values.name,
        category: values.category || undefined,
        purchaseDate: values.purchaseDate.toISOString(),
        cost: values.cost,
        salvageValue: values.salvageValue,
        usefulLifeMonths: values.usefulLifeMonths,
        depreciationMethod: values.depreciationMethod,
        accountId: values.accountId || undefined,
        notes: values.notes || undefined,
      };
      const record =
        isEdit && asset
          ? await assetsApi().update(asset.id, payload)
          : await assetsApi().create(payload);
      onSave(record);
      onOpenChange(false);
      toast.success(
        t("${name} saved", "تم حفظ ${name}").replace(
          "${name}",
          `${t("Asset", "الأصل")} ${record.name}`,
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("Edit fixed asset", "تعديل الأصل الثابت")
              : t("Register fixed asset", "تسجيل أصل ثابت")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Track a physical asset and depreciate it over its useful life.",
              "تتبّع أصل مادي واحتسب إهلاكه على مدى عمره الإنتاجي.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Code", "الكود")} *</FormLabel>
                    <FormControl>
                      <Input placeholder="ASSET-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Name", "الاسم")} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Category", "الفئة")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("e.g. Machinery, Vehicles", "مثال: معدات، مركبات")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Purchase date", "تاريخ الشراء")}</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Cost", "التكلفة")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salvageValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Salvage value", "قيمة الخردة")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usefulLifeMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Useful life (months)", "العمر الإنتاجي (أشهر)")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depreciationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Depreciation method", "طريقة الإهلاك")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select method…", "اختر الطريقة…")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="straight-line">{t("Straight-line", "القسط الثابت")}</SelectItem>
                          <SelectItem value="declining">{t("Declining balance", "الرصيد المتناقص")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("Asset account", "حساب الأصل")}</FormLabel>
                    <FormControl>
                      <Combobox options={accountOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder={t("Select an account…", "اختر حساباً…")} clearable />
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
                    : t("Register asset", "تسجيل الأصل")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}